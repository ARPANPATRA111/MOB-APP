package expo.modules.retailtools
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

class ArchiveCipherTest {
  private val password="test-only-password"
  private fun encode(bytes:ByteArray):ByteArray {val out=ByteArrayOutputStream();ArchiveCipher.encryptingStream(out,password).use{it.write(bytes)};return out.toByteArray()}
  private fun decode(bytes:ByteArray,pass:String=password,limit:Long=1024*1024):ByteArray {val out=ByteArrayOutputStream();ArchiveCipher.decrypt(ByteArrayInputStream(bytes),out,pass,limit);return out.toByteArray()}
  private fun rejected(action:()->Unit){try{action();fail("Expected authenticated archive rejection")}catch(e:Exception){assertNotNull(e)}}
  @Test fun roundTripMultipleChunks(){val input=ByteArray(160000){(it%251).toByte()};assertArrayEquals(input,decode(encode(input)))}
  @Test fun emptyArchive(){assertArrayEquals(ByteArray(0),decode(encode(ByteArray(0))))}
  @Test fun wrongPassword(){val encrypted=encode("private retail data".toByteArray());rejected{decode(encrypted,"incorrect-password")}}
  @Test fun rejectsCorruptionTruncationAndTrailingBytes(){
    val encrypted=encode(ByteArray(90000){it.toByte()})
    val changed=encrypted.clone();changed[50]=(changed[50].toInt() xor 1).toByte();rejected{decode(changed)}
    rejected{decode(encrypted.copyOf(encrypted.size-20))};rejected{decode(encrypted+byteArrayOf(1))}
  }
  @Test fun rejectsExcessiveOutput(){val encrypted=encode(ByteArray(1000));rejected{decode(encrypted,limit=100)}}
  @Test fun requiresStrongEnoughPassword(){rejected{ArchiveCipher.encryptingStream(ByteArrayOutputStream(),"short")}}
}
