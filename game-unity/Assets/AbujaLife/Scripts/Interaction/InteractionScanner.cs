using System;
using UnityEngine;
namespace AbujaLife.Interaction {
  public sealed class InteractionScanner : MonoBehaviour {
    public Transform origin; public float radius=1.6f; public LayerMask mask=-1; public event Action<IInteractable> FocusChanged; IInteractable _focus;
    void Update(){ IInteractable best=null; float bestD=float.MaxValue; foreach(var c in Physics.OverlapSphere(origin.position,radius,mask,QueryTriggerInteraction.Collide)){ var i=c.GetComponentInParent<IInteractable>(); if(i==null||!i.CanInteract)continue; float d=(c.ClosestPoint(origin.position)-origin.position).sqrMagnitude; if(d<bestD){bestD=d;best=i;} } if(!ReferenceEquals(best,_focus)){_focus=best;FocusChanged?.Invoke(_focus);} }
    public void Interact()=>_focus?.Interact();
  }
}
