using UnityEngine; using AbujaLife.Interaction;
namespace AbujaLife.Business {
 public sealed class BusinessVenue:MonoBehaviour,IInteractable { public string businessId; public string businessName="Business"; public string Prompt=>$"Enter {businessName}"; public bool CanInteract=>enabled; public void Interact(){Debug.Log($"Open business venue {businessId}");} }
}
