using UnityEngine;
namespace AbujaLife.World {
  public sealed class DayNightCycle : MonoBehaviour {
    public Light sun; [Range(0,24)] public float hour=15; public float realMinutesPerGameDay=48; public Gradient ambientColor; public AnimationCurve sunIntensity;
    void Update(){ hour=(hour+24f/(realMinutesPerGameDay*60f)*Time.deltaTime)%24f; float t=hour/24f; if(sun){sun.transform.rotation=Quaternion.Euler(t*360f-90f,155f,0);sun.intensity=sunIntensity.Evaluate(t);} RenderSettings.ambientLight=ambientColor.Evaluate(t); }
  }
}
