using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
namespace AbujaLife.Networking {
  public sealed class ApiClient : MonoBehaviour {
    string _baseUrl = "http://localhost:8787";
    public void Configure(string baseUrl) => _baseUrl = baseUrl.TrimEnd('/');
    public IEnumerator Get(string path, Action<string> ok, Action<string> fail) => Send("GET", path, null, ok, fail);
    public IEnumerator Post(string path, string json, Action<string> ok, Action<string> fail) => Send("POST", path, json, ok, fail);
    IEnumerator Send(string method, string path, string json, Action<string> ok, Action<string> fail) {
      using var req = new UnityWebRequest(_baseUrl + path, method);
      req.downloadHandler = new DownloadHandlerBuffer();
      if (json != null) { req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json)); req.SetRequestHeader("Content-Type", "application/json"); }
      req.timeout = 15;
      yield return req.SendWebRequest();
      if (req.result == UnityWebRequest.Result.Success) ok?.Invoke(req.downloadHandler.text);
      else fail?.Invoke($"{req.responseCode}: {req.error} {req.downloadHandler?.text}");
    }
  }
}
