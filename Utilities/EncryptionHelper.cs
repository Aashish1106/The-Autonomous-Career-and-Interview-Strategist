using System.Security.Cryptography;
using System.Text;

namespace AutoJobStrategist.Api.Utilities
{
    public static class EncryptionHelper
    {
        public static string Encrypt(string plainText, string key)
        {
            if (string.IsNullOrEmpty(plainText)) return plainText;

            byte[] iv = new byte[16];
            byte[] array;

            using (Aes aes = Aes.Create())
            {
                aes.Key = Encoding.UTF8.GetBytes(key.PadRight(32).Substring(0, 32));
                aes.GenerateIV(); // Dynamically generate a new IV for every single encryption
                iv = aes.IV;

                ICryptoTransform encryptor = aes.CreateEncryptor(aes.Key, aes.IV);

                using (MemoryStream memoryStream = new MemoryStream())
                {
                    using (CryptoStream cryptoStream = new CryptoStream(memoryStream, encryptor, CryptoStreamMode.Write))
                    {
                        using (StreamWriter streamWriter = new StreamWriter(cryptoStream))
                        {
                            streamWriter.Write(plainText);
                        }

                        array = memoryStream.ToArray();
                    }
                }
            }

            // Return the IV + Encrypted Data as a single Base64 string so it can be stored easily
            return Convert.ToBase64String(iv.Concat(array).ToArray());
        }

        public static string Decrypt(string cipherText, string key)
        {
            if (string.IsNullOrEmpty(cipherText)) return cipherText;

            byte[] fullCipher = Convert.FromBase64String(cipherText);
            byte[] iv = fullCipher.Take(16).ToArray();
            byte[] cipher = fullCipher.Skip(16).ToArray();

            using (Aes aes = Aes.Create())
            {
                aes.Key = Encoding.UTF8.GetBytes(key.PadRight(32).Substring(0, 32));
                aes.IV = iv;

                ICryptoTransform decryptor = aes.CreateDecryptor(aes.Key, aes.IV);

                using (MemoryStream memoryStream = new MemoryStream(cipher))
                {
                    using (CryptoStream cryptoStream = new CryptoStream(memoryStream, decryptor, CryptoStreamMode.Read))
                    {
                        using (StreamReader streamReader = new StreamReader(cryptoStream))
                        {
                            return streamReader.ReadToEnd();
                        }
                    }
                }
            }
        }
    }
}