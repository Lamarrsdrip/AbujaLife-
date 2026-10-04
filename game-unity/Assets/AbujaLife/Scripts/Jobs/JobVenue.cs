using UnityEngine; using AbujaLife.Interaction;
namespace AbujaLife.Jobs {
 public sealed class JobVenue:MonoBehaviour,IInteractable { public string jobId="ride_driver"; public string displayName="Start shift"; public GameObject jobController; public string Prompt=>displayName; public bool CanInteract=>jobController!=null; public void Interact()=>jobController.SetActive(true); }
}
