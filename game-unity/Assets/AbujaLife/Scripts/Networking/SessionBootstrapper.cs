using System; using UnityEngine;
namespace AbujaLife.Networking {
  [Serializable] sealed class GuestRequest { public string displayName; }
  [Serializable] sealed class Position { public float x,y,z; }
  [Serializable] sealed class PlayerDto { public string id,displayName,districtId; }
  [Serializable] sealed class WalletDto { public long balance; }
  [Serializable] sealed class GuestResponse { public PlayerDto player; public WalletDto wallet; }
  public sealed class SessionBootstrapper:MonoBehaviour {
    public ApiClient api; public PlayerSession session; public string fallbackName="New Resident";
    public void CreateGuest(string displayName=null){ var body=JsonUtility.ToJson(new GuestRequest{displayName=string.IsNullOrWhiteSpace(displayName)?fallbackName:displayName}); StartCoroutine(api.Post("/v1/session/guest",body,OnCreated,e=>Debug.LogError("Session failed: "+e))); }
    void OnCreated(string json){var dto=JsonUtility.FromJson<GuestResponse>(json);session.Apply(new PlayerSessionState{playerId=dto.player.id,displayName=dto.player.displayName,districtId=dto.player.districtId,walletBalance=(int)Math.Min(int.MaxValue,dto.wallet.balance)});}
  }
}
