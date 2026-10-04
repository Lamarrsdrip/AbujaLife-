using UnityEngine;
using AbujaLife.Networking;
using AbujaLife.World;
namespace AbujaLife.Core {
  public sealed class GameBootstrap : MonoBehaviour {
    public AppConfig config;
    public ApiClient apiClient;
    public WorldStreamManager worldStream;
    void Awake() {
      Application.targetFrameRate = config != null && config.target60Fps ? config.mobileTargetFrameRate : -1;
      QualitySettings.vSyncCount = 0;
      if (apiClient != null) apiClient.Configure(config.apiBaseUrl);
      DontDestroyOnLoad(gameObject);
    }
  }
}
