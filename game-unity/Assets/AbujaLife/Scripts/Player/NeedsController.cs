using System;
using UnityEngine;
namespace AbujaLife.Player {
  [Serializable] public struct NeedState { [Range(0,100)] public float hunger, energy, hygiene, social; }
  public sealed class NeedsController : MonoBehaviour {
    public NeedState current = new NeedState { hunger=90, energy=90, hygiene=90, social=80 };
    public event Action<NeedState> Changed;
    public void ApplyServerState(NeedState state) { current = state; Changed?.Invoke(current); }
  }
}
