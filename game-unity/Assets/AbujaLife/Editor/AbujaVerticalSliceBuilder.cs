#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using AbujaLife.Player;
using AbujaLife.CameraSystem;
using AbujaLife.World;

namespace AbujaLife.EditorTools {
 public static class AbujaVerticalSliceBuilder {
  const string ScenePath="Assets/AbujaLife/Scenes/AbujaVerticalSlice.unity";
  [MenuItem("AbujaLife/Build/Open World Vertical Slice")]
  public static void Build(){
   Directory.CreateDirectory("Assets/AbujaLife/Scenes"); Directory.CreateDirectory("Assets/AbujaLife/Generated");
   var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
   var root=new GameObject("ABUJA_WORLD_CODE_PROTOTYPE");
   var mats=CreateMaterials();
   CreateSun(root.transform);
   CreateGround(root.transform,mats[0]);
   BuildCentral(root.transform,new Vector3(0,0,0),mats);
   BuildWuse(root.transform,new Vector3(-650,0,-250),mats);
   BuildJabi(root.transform,new Vector3(700,0,-350),mats);
   BuildMaitama(root.transform,new Vector3(-450,0,650),mats);
   BuildGwarinpa(root.transform,new Vector3(950,0,700),mats);
   BuildCityGate(root.transform,new Vector3(0,0,-1050),mats);
   BuildAsoRock(root.transform,new Vector3(450,0,850),mats[7]);
   BuildRoad(root.transform,new Vector3(0,.04f,-520),new Vector3(1800,.08f,28),mats[1],"Airport Boulevard");
   BuildRoad(root.transform,new Vector3(-250,.05f,0),new Vector3(28,.08f,1800),mats[1],"Inner Parkway");
   BuildRoad(root.transform,new Vector3(520,.05f,350),new Vector3(1000,.08f,24),mats[1],"Jabi Connector");
   var player=CreatePlayer(new Vector3(-620,1,-220));
   var cam=CreateCamera(player.transform);
   player.GetComponent<ThirdPersonMotor>().cameraTransform=cam.transform;
   CreateClock(root.transform);
   EditorSceneManager.SaveScene(scene,ScenePath);
   Selection.activeGameObject=player;
   Debug.Log($"AbujaLife vertical slice generated at {ScenePath}. Geometry is intentionally placeholder-only; replace with production Abuja art while keeping gameplay components.");
  }

  static Material[] CreateMaterials(){
   string[] names={"SandstoneGround","RoadAsphalt","GlassBlue","ConcreteWarm","StoneDark","Greenery","Water","Rock","NightAccent"};
   Color[] colors={new(.48f,.50f,.42f),new(.065f,.07f,.075f),new(.12f,.28f,.35f),new(.62f,.55f,.46f),new(.18f,.17f,.16f),new(.10f,.28f,.12f),new(.05f,.28f,.42f),new(.26f,.24f,.20f),new(.12f,.45f,.23f)};
   var shader=Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard"); var result=new Material[names.Length];
   for(int i=0;i<names.Length;i++){string path=$"Assets/AbujaLife/Generated/{names[i]}.mat";var mat=AssetDatabase.LoadAssetAtPath<Material>(path);if(!mat){mat=new Material(shader){name=names[i],color=colors[i]};AssetDatabase.CreateAsset(mat,path);}result[i]=mat;} AssetDatabase.SaveAssets();return result;
  }
  static void CreateSun(Transform parent){var go=new GameObject("Abuja Sun");go.transform.SetParent(parent);go.transform.rotation=Quaternion.Euler(42,-32,0);var l=go.AddComponent<Light>();l.type=LightType.Directional;l.intensity=1.25f;l.shadows=LightShadows.Soft;RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.38f,.42f,.46f);}
  static void CreateGround(Transform parent,Material mat){var g=GameObject.CreatePrimitive(PrimitiveType.Plane);g.name="Abuja Terrain Placeholder";g.transform.SetParent(parent);g.transform.localScale=new Vector3(260,1,260);g.GetComponent<Renderer>().sharedMaterial=mat;}
  static GameObject Box(string name,Transform parent,Vector3 pos,Vector3 scale,Material mat){var o=GameObject.CreatePrimitive(PrimitiveType.Cube);o.name=name;o.transform.SetParent(parent);o.transform.position=pos;o.transform.localScale=scale;o.GetComponent<Renderer>().sharedMaterial=mat;return o;}
  static void BuildRoad(Transform parent,Vector3 pos,Vector3 scale,Material mat,string name){Box(name,parent,pos,scale,mat);for(int i=-8;i<=8;i++){var mark=Box("Lane Mark",parent,pos+new Vector3(scale.x>scale.z?i*scale.x/18f:0,.05f,scale.z>scale.x?i*scale.z/18f:0),scale.x>scale.z?new Vector3(scale.x/40f,.02f,.25f):new Vector3(.25f,.02f,scale.z/40f),mat);mark.GetComponent<Renderer>().sharedMaterial=mat;}}
  static void BuildCentral(Transform parent,Vector3 origin,Material[] m){var zone=new GameObject("Central Area");zone.transform.SetParent(parent);for(int x=-3;x<=3;x++)for(int z=-3;z<=3;z++){if(Mathf.Abs(x)<1||Mathf.Abs(z)<1)continue;float h=Random.Range(35f,110f);Box($"Central Tower {x}_{z}",zone.transform,origin+new Vector3(x*55,h/2,z*55),new Vector3(36,h,36),x%2==0?m[2]:m[3]);}var mosque=Box("National Mosque landmark proxy",zone.transform,origin+new Vector3(110,18,25),new Vector3(55,22,55),m[3]);CreateDome(mosque.transform,new Vector3(0,22,0),28,m[8]);var park=Box("Formal civic lawn",zone.transform,origin+new Vector3(-115,.4f,80),new Vector3(120,.8f,90),m[5]);}
  static void BuildWuse(Transform parent,Vector3 origin,Material[] m){var zone=new GameObject("Wuse II");zone.transform.SetParent(parent);for(int i=0;i<32;i++){float a=i/32f*Mathf.PI*2;float r=Random.Range(70,260);float h=Random.Range(12,38);var p=origin+new Vector3(Mathf.Cos(a)*r,h/2,Mathf.Sin(a)*r);Box($"Wuse Mixed Use {i:00}",zone.transform,p,new Vector3(Random.Range(18,34),h,Random.Range(18,34)),i%3==0?m[2]:m[3]);}for(int i=0;i<26;i++)Tree(zone.transform,origin+new Vector3(Random.Range(-260,260),0,Random.Range(-260,260)),m[5]);}
  static void BuildJabi(Transform parent,Vector3 origin,Material[] m){var zone=new GameObject("Jabi");zone.transform.SetParent(parent);Box("Jabi Lake",zone.transform,origin+new Vector3(0,.1f,80),new Vector3(440,.15f,260),m[6]);for(int i=0;i<18;i++){float h=Random.Range(18,55);Box($"Jabi Waterfront {i:00}",zone.transform,origin+new Vector3(Random.Range(-260,260),h/2-5,Random.Range(-220,-70)),new Vector3(Random.Range(20,38),h,Random.Range(20,38)),i%2==0?m[2]:m[3]);}for(int i=0;i<20;i++)Tree(zone.transform,origin+new Vector3(Random.Range(-300,300),0,Random.Range(-80,280)),m[5]);}
  static void BuildMaitama(Transform parent,Vector3 origin,Material[] m){var zone=new GameObject("Maitama");zone.transform.SetParent(parent);for(int i=0;i<22;i++){var p=origin+new Vector3(Random.Range(-320,320),3,Random.Range(-250,250));Box($"Maitama Villa {i:00}",zone.transform,p,new Vector3(Random.Range(22,38),Random.Range(6,12),Random.Range(22,40)),m[3]);Box("Compound Wall",zone.transform,p+new Vector3(0,-2,23),new Vector3(50,2,2),m[4]);}for(int i=0;i<48;i++)Tree(zone.transform,origin+new Vector3(Random.Range(-360,360),0,Random.Range(-300,300)),m[5]);}
  static void BuildGwarinpa(Transform parent,Vector3 origin,Material[] m){var zone=new GameObject("Gwarinpa");zone.transform.SetParent(parent);for(int row=0;row<6;row++)for(int col=0;col<8;col++){var p=origin+new Vector3(col*34-120,4,row*38-100);Box($"Gwarinpa Estate {row}_{col}",zone.transform,p,new Vector3(26,8,28),row%2==0?m[3]:m[4]);}}
  static void BuildCityGate(Transform parent,Vector3 origin,Material[] m){var zone=new GameObject("Abuja City Gate proxy");zone.transform.SetParent(parent);Box("Gate Left",zone.transform,origin+new Vector3(-34,18,0),new Vector3(12,36,14),m[3]);Box("Gate Right",zone.transform,origin+new Vector3(34,18,0),new Vector3(12,36,14),m[3]);Box("Gate Beam",zone.transform,origin+new Vector3(0,35,0),new Vector3(80,8,14),m[3]);}
  static void BuildAsoRock(Transform parent,Vector3 origin,Material mat){var zone=new GameObject("Aso Rock proxy");zone.transform.SetParent(parent);for(int i=0;i<9;i++){var s=GameObject.CreatePrimitive(PrimitiveType.Sphere);s.name=$"Rock Mass {i}";s.transform.SetParent(zone.transform);s.transform.position=origin+new Vector3(Random.Range(-70,70),Random.Range(35,95),Random.Range(-55,55));s.transform.localScale=new Vector3(Random.Range(70,130),Random.Range(100,180),Random.Range(65,120));s.GetComponent<Renderer>().sharedMaterial=mat;}}
  static void Tree(Transform parent,Vector3 pos,Material green){var t=new GameObject("Tree");t.transform.SetParent(parent);var trunk=GameObject.CreatePrimitive(PrimitiveType.Cylinder);trunk.transform.SetParent(t.transform);trunk.transform.position=pos+Vector3.up*3;trunk.transform.localScale=new Vector3(.7f,3,.7f);var crown=GameObject.CreatePrimitive(PrimitiveType.Sphere);crown.transform.SetParent(t.transform);crown.transform.position=pos+Vector3.up*8;crown.transform.localScale=new Vector3(7,7,7);crown.GetComponent<Renderer>().sharedMaterial=green;}
  static void CreateDome(Transform parent,Vector3 local,float scale,Material mat){var dome=GameObject.CreatePrimitive(PrimitiveType.Sphere);dome.name="Dome";dome.transform.SetParent(parent);dome.transform.localPosition=local;dome.transform.localScale=Vector3.one*scale;dome.GetComponent<Renderer>().sharedMaterial=mat;}
  static GameObject CreatePlayer(Vector3 pos){var p=GameObject.CreatePrimitive(PrimitiveType.Capsule);p.name="Player_AbujaResident";Object.DestroyImmediate(p.GetComponent<CapsuleCollider>());p.transform.position=pos;var cc=p.AddComponent<CharacterController>();cc.height=1.85f;cc.radius=.34f;var motor=p.AddComponent<ThirdPersonMotor>();return p;}
  static Camera CreateCamera(Transform player){var go=new GameObject("Main Camera");go.tag="MainCamera";var cam=go.AddComponent<Camera>();cam.fieldOfView=65;var orbit=go.AddComponent<OrbitCamera>();orbit.target=player;go.transform.position=player.position+new Vector3(0,2,-5);return cam;}
  static void CreateClock(Transform parent){var go=new GameObject("World Time & Weather");go.transform.SetParent(parent);var cycle=go.AddComponent<DayNightCycle>();cycle.sun=Object.FindFirstObjectByType<Light>();cycle.hour=16.5f;cycle.realMinutesPerGameDay=72;}
 }
}
#endif
