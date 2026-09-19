package expo.modules.retailtools
import android.bluetooth.BluetoothManager
import android.graphics.BitmapFactory
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.*
import java.net.InetSocketAddress
import java.net.Socket
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream
class RetailToolsModule : Module() {
  private fun owned(uri: String): File {
    val context = appContext.reactContext ?: error("App unavailable")
    val file = File(Uri.parse(uri).path ?: error("Invalid file")).canonicalFile
    val roots = listOf(context.filesDir.canonicalPath, context.cacheDir.canonicalPath)
    require(roots.any { file.path.startsWith(it + File.separator) }) { "File must be in app storage" }
    return file
  }
  override fun definition() = ModuleDefinition {
    Name("RetailTools")
    AsyncFunction("packBackup") { directory: String, destination: String, password: String ->
      val root = owned(directory); val output = owned(destination)
      val entries = root.walkTopDown().filter { it.isFile }.toList()
      require(entries.size <= 50002) { "Too many backup files" }
      require(entries.sumOf { it.length() } <= 1024L * 1024 * 1024) { "Backup contents exceed 1 GB" }
      try {
        output.outputStream().buffered().use { stream ->
          ZipOutputStream(ArchiveCipher.encryptingStream(stream, password)).use { zip ->
            entries.forEach { file ->
              require(file.canonicalPath.startsWith(root.canonicalPath + File.separator)) { "Invalid archive path" }
              zip.putNextEntry(ZipEntry(file.relativeTo(root).path.replace(File.separatorChar, '/')))
              file.inputStream().use { it.copyTo(zip) }; zip.closeEntry()
            }
          }
        }
              require(output.length() <= 512L * 1024 * 1024) { "Backup exceeds 512 MB; reduce stored photos before backing up" }
      } catch (error: Exception) { output.delete(); throw error }
      Uri.fromFile(output).toString()
    }
    AsyncFunction("unpackBackup") { source: String, destination: String, password: String ->
      val input = owned(source); val root = owned(destination)
      require(!root.exists()) { "Restore staging directory already exists" }
      require(input.length() <= 512L * 1024 * 1024) { "Backup exceeds 512 MB" }
      root.mkdirs(); val archive = File(root, "verified.zip")
      try {
        input.inputStream().buffered().use { stream -> archive.outputStream().use { out -> ArchiveCipher.decrypt(stream,out,password,512L*1024*1024) } }
        var total=0L; var count=0; val names=HashSet<String>()
        ZipInputStream(archive.inputStream().buffered()).use { zip ->
          while(true){val entry=zip.nextEntry ?: break;count++;require(count<=50002){"Too many backup files"}
            require(entry.name=="manifest.json" || entry.name=="database.db" || Regex("images/[a-zA-Z0-9_-]+\\.(jpg|png|webp)").matches(entry.name)){"Unsupported archive entry"}
            require(names.add(entry.name)){"Duplicate archive entry"};val out=File(root,entry.name).canonicalFile
            require(out.path.startsWith(root.canonicalPath+File.separator)){"Invalid archive path"};out.parentFile?.mkdirs()
            out.outputStream().use { stream -> val buffer=ByteArray(65536);var fileSize=0L
              while(true){val n=zip.read(buffer);if(n<0)break;total+=n;fileSize+=n;require(total<=1024L*1024*1024){"Expanded backup exceeds 1 GB"};if(entry.name=="manifest.json")require(fileSize<=2*1024*1024){"Manifest too large"};stream.write(buffer,0,n)}
            };zip.closeEntry()
          }
        }
        require(File(root,"manifest.json").exists() && File(root,"database.db").exists()){"Backup is incomplete"}
        archive.delete(); Uri.fromFile(root).toString()
      } catch(error:Exception){root.deleteRecursively();throw IllegalArgumentException("Cannot open backup. Check the password and file integrity.",error)}
    }
    AsyncFunction("sha256") { uri:String ->
      val digest=java.security.MessageDigest.getInstance("SHA-256")
      owned(uri).inputStream().use { input -> val buffer=ByteArray(65536);while(true){val n=input.read(buffer);if(n<0)break;digest.update(buffer,0,n)} }
      digest.digest().joinToString(""){"%02x".format(it)}
    }
    AsyncFunction("renderReceipt") { text:String, width:Int ->
      require(width==384||width==576){"Choose 58 mm or 80 mm paper"};require(text.length<=60000){"Receipt is too long"}
      val paint=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).also{it.color=android.graphics.Color.BLACK;it.textSize=if(width==384)21f else 24f;it.typeface=android.graphics.Typeface.create("sans-serif",android.graphics.Typeface.NORMAL)}
      val lines=mutableListOf<String>()
      for(line in text.split('\n')){var rest=line;if(rest.isEmpty())lines.add("");while(rest.isNotEmpty()){val count=paint.breakText(rest,true,(width-24).toFloat(),null).coerceAtLeast(1);lines.add(rest.take(count));rest=rest.drop(count)}}
      val step=paint.fontSpacing+5;val height=(lines.size*step+24).toInt();require(height<=30000){"Receipt is too long for thermal printing; use PDF"}
      val bitmap=android.graphics.Bitmap.createBitmap(width,height,android.graphics.Bitmap.Config.ARGB_8888);val canvas=android.graphics.Canvas(bitmap);canvas.drawColor(android.graphics.Color.WHITE)
      lines.forEachIndexed { index,line -> canvas.drawText(line,12f,12f-paint.fontMetrics.top+index*step,paint) }
      val context=appContext.reactContext ?: error("App unavailable");val file=File(context.cacheDir,"receipt-${UUID.randomUUID()}.png")
      file.outputStream().use{bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)};bitmap.recycle();Uri.fromFile(file).toString()
    }
    AsyncFunction("pairedPrinters") {
      val manager=appContext.reactContext?.getSystemService(BluetoothManager::class.java)
      val adapter=manager?.adapter ?: error("Bluetooth is unavailable")
      require(adapter.isEnabled){"Turn on Bluetooth in Android settings"}
      adapter.bondedDevices.map { mapOf("name" to (it.name ?: "Paired printer"), "address" to it.address) }
    }
    AsyncFunction("printReceipt") { transport:String, address:String, port:Int, imageUri:String ->
      val bitmap=BitmapFactory.decodeFile(owned(imageUri).path) ?: error("Receipt image unavailable")
      require(bitmap.width<=576 && bitmap.height<=30000){"Receipt is too large"}
      val bytes=ByteArrayOutputStream();bytes.write(byteArrayOf(27,64))
      // ESC/POS raster strips avoid overflowing small printer buffers; non-Latin text is rasterized.
      for(top in 0 until bitmap.height step 128){val h=minOf(128,bitmap.height-top);val widthBytes=(bitmap.width+7)/8
        bytes.write(byteArrayOf(29,118,48,0,(widthBytes and 255).toByte(),(widthBytes shr 8).toByte(),(h and 255).toByte(),(h shr 8).toByte()))
        for(y in top until top+h)for(xb in 0 until widthBytes){var bits=0;for(bit in 0..7){val x=xb*8+bit;if(x<bitmap.width){val pixel=bitmap.getPixel(x,y);val luminance=((pixel shr 16 and 255)*299+(pixel shr 8 and 255)*587+(pixel and 255)*114)/1000;if(luminance<160)bits=bits or (128 shr bit)}};bytes.write(bits)}
      }
      bitmap.recycle();bytes.write(byteArrayOf(10,10,10,29,86,66,0));val payload=bytes.toByteArray()
      if(transport=="network"){
        require(port in 1..65535 && address.isNotBlank()){"Enter printer host and port"}
        Socket().use { socket ->
          val timer=java.util.Timer(true);timer.schedule(object:java.util.TimerTask(){override fun run(){try{socket.close()}catch(_:Exception){}}},15000)
          try{socket.connect(InetSocketAddress(address,port),6000);socket.getOutputStream().use { it.write(payload);it.flush() }}finally{timer.cancel()}
        }
      }else{
        require(transport=="bluetooth" && android.bluetooth.BluetoothAdapter.checkBluetoothAddress(address)){"Select a paired printer"}
        val adapter=appContext.reactContext?.getSystemService(BluetoothManager::class.java)?.adapter ?: error("Bluetooth unavailable")
        val device=adapter.bondedDevices.firstOrNull{it.address==address} ?: error("Pair this printer in Android settings first")
        device.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")).use { socket ->
          // Close a stalled connection instead of leaving a print task running indefinitely.
          val timer=java.util.Timer(true);timer.schedule(object:java.util.TimerTask(){override fun run(){try{socket.close()}catch(_:Exception){}}},15000)
          try{socket.connect();socket.outputStream.write(payload);socket.outputStream.flush()}finally{timer.cancel()}
        }
      }
      true
    }
  }
}
