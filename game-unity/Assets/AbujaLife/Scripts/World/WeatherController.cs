using UnityEngine;
namespace AbujaLife.World {
 public sealed class WeatherController : MonoBehaviour {
   public enum Weather { Clear, Overcast, Rain, Harmattan }
   public Weather current=Weather.Clear; public ParticleSystem rain; public Light sun; public Material skyboxClear,skyboxOvercast;
   public void SetWeather(Weather weather){current=weather;if(rain){ if(weather==Weather.Rain) rain.Play(); else rain.Stop(); } if(sun) sun.intensity=weather switch{Weather.Clear=>1.05f,Weather.Overcast=>.55f,Weather.Rain=>.38f,Weather.Harmattan=>.72f,_=>1f}; RenderSettings.skybox=(weather==Weather.Overcast||weather==Weather.Rain)?skyboxOvercast:skyboxClear; DynamicGI.UpdateEnvironment();}
 }
}
