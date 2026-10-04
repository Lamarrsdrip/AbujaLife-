using System.Collections; using UnityEngine; using UnityEngine.SceneManagement; using AbujaLife.Interaction;
namespace AbujaLife.World {
  public sealed class BuildingPortal : MonoBehaviour, IInteractable {
    public string prompt="Enter"; public string interiorScene; public Transform exitAnchor; bool _busy; public string Prompt=>prompt; public bool CanInteract=>!_busy;
    public void Interact(){ if(!_busy)StartCoroutine(Enter()); }
    IEnumerator Enter(){_busy=true; var op=SceneManager.LoadSceneAsync(interiorScene,LoadSceneMode.Additive); if(op!=null)yield return op; var scene=SceneManager.GetSceneByName(interiorScene); SceneManager.SetActiveScene(scene); _busy=false;}
  }
}
