using TMPro; using UnityEngine; using AbujaLife.Networking;
namespace AbujaLife.UI { public sealed class WorldHud:MonoBehaviour { public TMP_Text districtLabel,timeLabel,walletLabel; public DayNightCycleProxy clock; public PlayerSession session; public string district="Wuse II"; void Update(){if(districtLabel)districtLabel.text=district;if(timeLabel&&clock)timeLabel.text=clock.TimeText;if(walletLabel&&session?.State!=null)walletLabel.text=$"₦{session.State.walletBalance:N0}";} }
 public sealed class DayNightCycleProxy:MonoBehaviour { public AbujaLife.World.DayNightCycle source; public string TimeText { get { if(!source)return "--:--";int h=Mathf.FloorToInt(source.hour);int m=Mathf.FloorToInt((source.hour-h)*60);return $"{h:00}:{m:00}";} } }
}
