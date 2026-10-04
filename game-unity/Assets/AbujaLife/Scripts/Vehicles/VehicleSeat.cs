using UnityEngine; using AbujaLife.Interaction;
namespace AbujaLife.Vehicles {
 public sealed class VehicleSeat : MonoBehaviour,IInteractable { public string seatName="Drive"; public Transform sitAnchor; public bool occupied; public string Prompt=>occupied?"Occupied":seatName; public bool CanInteract=>!occupied; public void Interact(){ /* Session controller owns avatar parenting/input swap. */ } }
}
