using System;
using UnityEngine;
namespace AbujaLife.Networking {
  [Serializable] public sealed class PlayerSessionState { public string playerId; public string displayName; public string districtId; public int walletBalance; }
  public sealed class PlayerSession : MonoBehaviour {
    public PlayerSessionState State { get; private set; }
    public event Action<PlayerSessionState> Changed;
    public void Apply(PlayerSessionState next) { State = next; Changed?.Invoke(State); }
  }
}
