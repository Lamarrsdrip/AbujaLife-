using UnityEngine;
namespace AbujaLife.Marketplace {
 public sealed class OkrikaBridge:MonoBehaviour { public string okrikaBaseUrl="https://okrika.store"; public void Open(string playerId,string district,string query=""){var url=$"{okrikaBaseUrl.TrimEnd('/')}/explore?src=abujalife&player={UnityEngine.Networking.UnityWebRequest.EscapeURL(playerId)}&district={UnityEngine.Networking.UnityWebRequest.EscapeURL(district)}&q={UnityEngine.Networking.UnityWebRequest.EscapeURL(query)}"; Application.OpenURL(url);} }
}
