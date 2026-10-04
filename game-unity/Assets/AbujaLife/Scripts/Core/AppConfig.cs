using UnityEngine;
namespace AbujaLife.Core {
  [CreateAssetMenu(menuName="AbujaLife/App Config")]
  public sealed class AppConfig : ScriptableObject {
    [Header("Server")]
    public string apiBaseUrl = "http://localhost:8787";
    public string okrikaBaseUrl = "https://okrika.store";
    [Header("World")]
    [Min(50)] public float districtLoadRadiusMeters = 850f;
    [Min(60)] public float districtUnloadRadiusMeters = 1200f;
    [Header("Quality")]
    public bool target60Fps = true;
    public int mobileTargetFrameRate = 60;
  }
}
