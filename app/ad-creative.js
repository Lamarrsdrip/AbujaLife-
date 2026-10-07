const bytes=data=>Math.floor((data.split(',')[1]?.length||0)*3/4)-(data.endsWith('==')?2:data.endsWith('=')?1:0);
export function compressAdSource(source,{makeCanvas=()=>document.createElement('canvas'),maxBytes=44*1024}={}){
 const originalWidth=source.width||source.naturalWidth,originalHeight=source.height||source.naturalHeight;
 if(!originalWidth||!originalHeight)throw new Error('Could not read this image.');
 let scale=Math.min(1,900/Math.max(originalWidth,originalHeight)),quality=.84,data='';
 for(let pass=0;pass<16;pass++){
  const canvas=makeCanvas();canvas.width=Math.max(1,Math.round(originalWidth*scale));canvas.height=Math.max(1,Math.round(originalHeight*scale));
  const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(source,0,0,canvas.width,canvas.height);
  data=canvas.toDataURL('image/webp',quality);
  // Safari may silently encode PNG for an unsupported WebP request. PNG ignores
  // the quality argument, so explicitly fall back to its supported JPEG encoder.
  if(!data.startsWith('data:image/webp;'))data=canvas.toDataURL('image/jpeg',quality);
  if(bytes(data)<=maxBytes)return data;
  quality=Math.max(.48,quality-.08);scale*=.82;
 }
 throw new Error('This image could not be prepared. Try a different JPEG or PNG.');
}
export async function optimizeAdImage(file){
 if(!/^image\/(png|jpeg|webp)$/.test(file?.type||''))throw new Error('Choose a PNG, JPEG or WebP image.');
 if(file.size>20*1024*1024)throw new Error('Choose an image smaller than 20 MB.');
 let source;
 if(globalThis.createImageBitmap)try{source=await createImageBitmap(file);}catch{/* Use the image decoder supported by Safari. */}
 if(!source)source=await new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not read this image.'));};image.src=url;});
 try{return compressAdSource(source);}finally{source.close?.();}
}
