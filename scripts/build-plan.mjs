import{build}from'esbuild';import{mkdir,cp,copyFile}from'node:fs/promises';
export async function buildPlan({development=false}={}){
 const directory=development?'.local/frontend':'dist/src';await mkdir(directory,{recursive:true});
 await build({entryPoints:['src/plan-review.js'],bundle:true,format:'esm',platform:'browser',target:['chrome120','safari17.4','firefox115'],outfile:directory+'/plan-review.js',minify:true,legalComments:'inline'});
 if(!development){const target='dist/vendor/pdfjs';await mkdir(target,{recursive:true});await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs',target+'/pdf.worker.min.mjs');await copyFile('node_modules/pdfjs-dist/LICENSE',target+'/LICENSE.txt');for(const name of ['standard_fonts','cmaps','wasm'])await cp('node_modules/pdfjs-dist/'+name,target+'/'+name,{recursive:true});}
}
if(process.argv[1]?.endsWith('build-plan.mjs'))await buildPlan({development:process.argv.includes('--dev')});
