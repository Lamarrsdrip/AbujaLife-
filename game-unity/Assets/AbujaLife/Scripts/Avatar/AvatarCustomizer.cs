using System;
using UnityEngine;
namespace AbujaLife.Avatar {
  [Serializable] public sealed class AvatarStyle { public string skinTone="deep"; public string hair="fade"; public string top="starter_tee"; public string bottom="starter_trouser"; public string shoes="starter_sneaker"; public string accessory="none"; }
  public sealed class AvatarCustomizer : MonoBehaviour {
    public SkinnedMeshRenderer bodyRenderer; public Material[] skinMaterials; public GameObject[] hairVariants; public GameObject[] topVariants; public GameObject[] bottomVariants; public GameObject[] shoeVariants;
    public AvatarStyle Current { get; private set; } = new();
    public void Apply(AvatarStyle style){ Current=style??new AvatarStyle(); SetOne(hairVariants,Current.hair); SetOne(topVariants,Current.top); SetOne(bottomVariants,Current.bottom); SetOne(shoeVariants,Current.shoes); if(bodyRenderer&&skinMaterials!=null&&skinMaterials.Length>0){int idx=Mathf.Abs(Current.skinTone.GetHashCode())%skinMaterials.Length;bodyRenderer.material=skinMaterials[idx];}}
    static void SetOne(GameObject[] variants,string id){ if(variants==null)return; foreach(var go in variants) if(go) go.SetActive(go.name.Equals(id,StringComparison.OrdinalIgnoreCase)); }
  }
}
