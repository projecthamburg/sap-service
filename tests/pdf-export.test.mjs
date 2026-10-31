import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument,PDFName,PDFDict,PDFArray,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
import {createEstimatePDF} from '../src/pdf-export.js';
import {initialState,sampleState} from '../src/model.js';
const assets = {regular:await readFile(new URL('../public/fonts/Figtree-Regular.ttf',import.meta.url)),bold:await readFile(new URL('../public/fonts/Figtree-Bold.ttf',import.meta.url))};
function embeddedEstimate(pdf) {
 const tree=pdf.catalog.lookup(PDFName.of('Names'),PDFDict).lookup(PDFName.of('EmbeddedFiles'),PDFDict);
 const spec=tree.lookup(PDFName.of('Names'),PDFArray).lookup(1,PDFDict);
 const stream=spec.lookup(PDFName.of('EF'),PDFDict).lookup(PDFName.of('F'),PDFRawStream);
 return JSON.parse(new TextDecoder().decode(decodePDFRawStream(stream).decode()));
}
test('downloadable brochure is a real branded PDF with exact customer scope and calculation attachment',async()=>{
 const cases=[{language:'en',scope:sampleState()},{language:'fr',scope:{...initialState(),name:'Bureaux — essai français',city:'Ottawa',province:'ON',area:240/0.09290304,unit:'m2',category:'office',phases:['rough','final'],washrooms:3,visits:3}}];
 const results=[];
 for(const [i,input] of cases.entries()) {
  const result=await createEstimatePDF({...input,documentId:'SAP-TEST-'+i,generatedAt:'2026-10-31T00:00:00Z',files:[]},assets);
  assert.equal(Buffer.from(result.bytes).subarray(0,5).toString(),'%PDF-');
  const pdf=await PDFDocument.load(result.bytes);
  assert.equal(pdf.getAuthor(),'Project Hamburg');assert.ok(pdf.getPageCount()>=4);
  const stored=embeddedEstimate(pdf);
  assert.deepEqual(stored.scope,input.scope);assert.deepEqual(stored.estimate,result.estimate);
  assert.equal(stored.documentId,'SAP-TEST-'+i);assert.ok(stored.estimate.mid>650);
  assert.ok(pdf.getTitle().includes(input.scope.name));results.push(stored.estimate.mid);
 }
 assert.notEqual(results[0],results[1]);
});
test('brochure refuses incomplete or contradictory measurements before producing a misleading document',async()=>{
 await assert.rejects(createEstimatePDF({scope:{...initialState(),city:'Montréal',area:2000,gross:1000}},assets),/Complete the required/);
 await assert.rejects(createEstimatePDF({scope:{...initialState(),city:'Montréal',area:100}},assets),/Complete the required/);
});
