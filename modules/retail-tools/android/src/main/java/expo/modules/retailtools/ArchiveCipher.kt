package expo.modules.retailtools

import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/** Version 2 archives authenticate bounded chunks and a final empty chunk.
 * A sequence number in the nonce/AAD detects reordering; the final chunk detects truncation.
 * Memory stays bounded even with providers that buffer GCM decryption until authentication.
 */
internal object ArchiveCipher {
  private val magic = "MOPXBK02".toByteArray(Charsets.US_ASCII)
  private const val chunkSize = 65536
  private fun key(password:String,salt:ByteArray):SecretKeySpec {
    require(password.length in 10..1024){"Use a backup password of at least 10 characters"}
    val spec=PBEKeySpec(password.toCharArray(),salt,600000,256)
    try{return SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded,"AES")}
    finally{spec.clearPassword()}
  }
  private fun cipher(mode:Int,key:SecretKeySpec,prefix:ByteArray,index:Int):Cipher {
    val nonce=ByteBuffer.allocate(12).put(prefix).putInt(index).array()
    return Cipher.getInstance("AES/GCM/NoPadding").also{it.init(mode,key,GCMParameterSpec(128,nonce));it.updateAAD(magic);it.updateAAD(nonce)}
  }
  fun encryptingStream(output:OutputStream,password:String):OutputStream {
    val salt=ByteArray(16).also{SecureRandom().nextBytes(it)};val prefix=ByteArray(8).also{SecureRandom().nextBytes(it)}
    val key=key(password,salt);val target=DataOutputStream(output);target.write(magic);target.write(salt);target.write(prefix)
    return object:OutputStream(){
      private val buffer=ByteArray(chunkSize);private var used=0;private var index=0;private var closed=false
      private fun chunk(){check(index<Int.MAX_VALUE);val encrypted=cipher(Cipher.ENCRYPT_MODE,key,prefix,index++).doFinal(buffer,0,used);target.writeInt(encrypted.size);target.write(encrypted);used=0}
      override fun write(value:Int){check(!closed);buffer[used++]=value.toByte();if(used==chunkSize)chunk()}
      override fun write(bytes:ByteArray,offset:Int,length:Int){check(!closed);var pos=offset;var remaining=length;while(remaining>0){val n=minOf(remaining,chunkSize-used);System.arraycopy(bytes,pos,buffer,used,n);used+=n;pos+=n;remaining-=n;if(used==chunkSize)chunk()}}
      override fun flush(){target.flush()}
      override fun close(){if(closed)return;try{if(used>0)chunk();chunk();target.flush()}finally{closed=true;buffer.fill(0);target.close()}}
    }
  }
  fun decrypt(input:InputStream,output:OutputStream,password:String,maxBytes:Long){
    val source=DataInputStream(input);val header=ByteArray(8);source.readFully(header);require(header.contentEquals(magic)){"Not a supported MOPX backup"}
    val salt=ByteArray(16);source.readFully(salt);val prefix=ByteArray(8);source.readFully(prefix);val key=key(password,salt)
    var index=0;var total=0L
    while(true){
      val length=source.readInt();require(length in 16..chunkSize+16){"Invalid backup chunk"};check(index<Int.MAX_VALUE)
      val encrypted=ByteArray(length);source.readFully(encrypted)
      val plain=cipher(Cipher.DECRYPT_MODE,key,prefix,index++).doFinal(encrypted)
      if(plain.isEmpty()){require(source.read()==-1){"Unexpected data after backup"};break}
      total+=plain.size;require(total<=maxBytes){"Backup exceeds supported size"};output.write(plain);plain.fill(0)
    }
  }
}
