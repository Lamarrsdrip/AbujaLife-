using System.Collections; using System.Collections.Generic; using UnityEngine; using UnityEngine.SceneManagement;
namespace AbujaLife.World {
  public sealed class WorldStreamManager : MonoBehaviour {
    public DistrictCatalog catalog; public Transform player; readonly HashSet<string> _loaded=new(); readonly HashSet<string> _busy=new();
    void Update(){ if(catalog==null||player==null)return; foreach(var d in catalog.districts){ float dist=Vector3.Distance(new Vector3(player.position.x,0,player.position.z),new Vector3(d.anchor.x,0,d.anchor.z)); foreach(var scene in d.sceneNames){ if(dist<=d.loadRadius&&!_loaded.Contains(scene)&&!_busy.Contains(scene)) StartCoroutine(Load(scene)); else if(dist>d.unloadRadius&&_loaded.Contains(scene)&&!_busy.Contains(scene)) StartCoroutine(Unload(scene)); } } }
    IEnumerator Load(string scene){_busy.Add(scene); var op=SceneManager.LoadSceneAsync(scene,LoadSceneMode.Additive); if(op!=null)yield return op; _busy.Remove(scene); _loaded.Add(scene);}
    IEnumerator Unload(string scene){_busy.Add(scene); var op=SceneManager.UnloadSceneAsync(scene); if(op!=null)yield return op; _busy.Remove(scene); _loaded.Remove(scene);}
  }
}
