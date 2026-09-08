const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
async function main(){
 const root=path.join(__dirname,'assets');fs.mkdirSync(root,{recursive:true});
 // Preserve the COMPLETE approved lockup from the board: all three loops AND both wordmark lines.
 // Only remove the ivory backdrop and normalise foreground colour; never redraw the design.
 const source=path.resolve(__dirname,'../../brand/connection-v2-stock/brand-board.png');
 const {data,info}=await sharp(source).extract({left:65,top:108,width:675,height:246}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 for(const [name,col] of [['approved-logo-ink',[37,47,32]],['approved-logo-paper',[247,247,242]]]){
  const pixels=Buffer.alloc(info.width*info.height*4);
  for(let i=0;i<info.width*info.height;i++){
   const luminance=(data[i*3]+data[i*3+1]+data[i*3+2])/3;
   const alpha=Math.round(255*Math.max(0,Math.min(1,(235-luminance)/150)));
   pixels[i*4]=col[0];pixels[i*4+1]=col[1];pixels[i*4+2]=col[2];pixels[i*4+3]=alpha;
  }
  await sharp(pixels,{raw:{width:info.width,height:info.height,channels:4}}).png().toFile(path.join(root,name+'.png'));
 }
 const dark=await sharp(path.join(root,'approved-logo-ink.png')).flatten({background:'#F7F7F2'}).toBuffer();
 const light=await sharp(path.join(root,'approved-logo-paper.png')).flatten({background:'#252F20'}).toBuffer();
 await sharp({create:{width:715,height:552,channels:3,background:'#F7F7F2'}}).composite([{input:dark,left:20,top:15},{input:light,left:20,top:291}]).png().toFile(path.join(__dirname,'logo-proof.png'));
 console.log('Approved complete logo extracted; transparent ink and paper versions created.');
}
main().catch(e=>{console.error(e);process.exit(1)});
