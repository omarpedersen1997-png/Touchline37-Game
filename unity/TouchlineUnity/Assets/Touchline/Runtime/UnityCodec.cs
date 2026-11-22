using Touchline.Core;
using UnityEngine;

namespace Touchline.Runtime
{
    public sealed class UnityCodec : ITextCodec
    {
        public string Encode<T>(T data) where T : class => JsonUtility.ToJson(data);
        public T Decode<T>(string data) where T : class => JsonUtility.FromJson<T>(data);
    }
}
