// Versioned geometry and reconciliation contract. It never changes price inputs.
export const PLAN_PROTOCOL = 'sap-plan-review-v1';
export const PLAN_LIMITS = {core:1280,padding:128,maxTiles:64,maxPixels:64000000,maxSide:16000,batchSize:4,relativeTolerance:0.05,absoluteToleranceSqFt:2};
export function planTiles(width,height,{core=PLAN_LIMITS.core,padding=PLAN_LIMITS.padding}={}) {
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>PLAN_LIMITS.maxSide||height>PLAN_LIMITS.maxSide||width*height>PLAN_LIMITS.maxPixels||!Number.isSafeInteger(core)||core<64||!Number.isSafeInteger(padding)||padding<0||padding>core/2)throw new RangeError('Plan resolution exceeds the review limit.');
 const tiles=[];
 for(let y=0,row=0;y<height;y+=core,row++)for(let x=0,col=0;x<width;x+=core,col++){
  const cw=Math.min(core,width-x),ch=Math.min(core,height-y),left=Math.max(0,x-padding),top=Math.max(0,y-padding),right=Math.min(width,x+cw+padding),bottom=Math.min(height,y+ch+padding);
  tiles.push({id:`r${row+1}c${col+1}`,row,col,x:left,y:top,width:right-left,height:bottom-top,core:{x,y,width:cw,height:ch}});
 }
 if(tiles.length>PLAN_LIMITS.maxTiles)throw new RangeError('This page needs more tiles than one review supports. Use separate pages or a lower-resolution export.');
 return tiles;
}
export function coverageAudit(width,height,tiles){
 const expected=planTiles(width,height);
 const same=tiles.length===expected.length&&expected.every((t,i)=>JSON.stringify(t)===JSON.stringify(tiles[i]));
 return {complete:same,pixelArea:width*height,coveredCoreArea:tiles.reduce((s,t)=>s+t.core.width*t.core.height,0),tileCount:tiles.length,coreSize:PLAN_LIMITS.core,padding:PLAN_LIMITS.padding,method:'Non-overlapping ownership cores; overlapping context retained in padded tiles.'};
}
const normalize=(s)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^\s*\d+\s*[/.·-]?\s*/,'').replace(/[^a-z0-9]+/g,' ').trim();
export function roomKey(label){
 const raw=normalize(label).split(' / ')[0];
 const map=[[/living|dining|sejour|salle a manger/,'living dining'],[/primary bedroom|chambre principale/,'primary bedroom'],[/walk in|penderie/,'walk in closet'],[/kitchen|cuisine/,'kitchen'],[/bathroom|washroom|salle de bain/,'bathroom'],[/bedroom|chambre/,'bedroom'],[/laundry|buanderie/,'laundry'],[/storage|rangement/,'storage'],[/corridor|hallway|couloir/,'corridor']];
 for(const[re,key]of map)if(re.test(raw))return key+(raw.match(/\d+$/)?.[0]?' '+raw.match(/\d+$/)[0]:'');
 return raw;
}
function sqft(value,unit){if(typeof value!=='number'||!Number.isFinite(value)||value<=0)return null;return unit==='m2'?value/0.09290304:unit==='ft2'?value:null;}
export function claimArea(claim){
 const stated=sqft(claim.areaValue,claim.areaUnit);
 const dim=claim.lengthValue>0&&claim.widthValue>0?sqft(claim.lengthValue*claim.widthValue,claim.dimensionUnit==='m'?'m2':claim.dimensionUnit==='ft'?'ft2':'unknown'):null;
 const conflicts=stated&&dim&&Math.abs(stated-dim)>Math.max(2,stated*.05);
 return{sqft:claim.confidence==='readable'&&!conflicts?(stated||dim):null,statedSqFt:stated,dimensionSqFt:dim,conflicts:Boolean(conflicts),method:stated?'printed-area':dim?'printed-dimensions':'unknown'};
}
function overlap(a,b){const x=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)),y=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));return x*y/Math.max(1,Math.min(a.width*a.height,b.width*b.height));}
export function stitchClaims(raw,tiles){
 const groups=[];
 for(const claim of raw){
  const tile=tiles.find(t=>t.id===claim.tileId);if(!tile)continue;
  const b=claim.box;if(!b||['x','y','width','height'].some(k=>!Number.isFinite(b[k]))||b.x<0||b.y<0||b.width<=0||b.height<=0||b.x+b.width>1001||b.y+b.height>1001)continue;
  const box={x:tile.x+b.x/1000*tile.width,y:tile.y+b.y/1000*tile.height,width:b.width/1000*tile.width,height:b.height/1000*tile.height};
  // Names alone never join rooms. Matching labels must also overlap spatially.
  let group=groups.find(g=>roomKey(g.label)===roomKey(claim.label)&&g.kind===claim.kind&&overlap(g.box,box)>.35);
  if(!group){group={id:'room-'+String(groups.length+1).padStart(3,'0'),label:String(claim.label).slice(0,150),kind:claim.kind,box,evidence:[]};groups.push(group);}
  group.evidence.push({...claim,globalBox:box});
 }
 return groups.map(g=>{
  const readings=g.evidence.map(claimArea),areas=readings.map(r=>r.sqft).filter(v=>v!==null);
  const conflictingEvidence=readings.some(r=>r.conflicts)||areas.length>1&&Math.max(...areas)-Math.min(...areas)>Math.max(2,Math.max(...areas)*.05);
  return{...g,areaSqFt:!conflictingEvidence&&areas.length?areas[0]:null,conflictingEvidence:Boolean(conflictingEvidence),confidence:!conflictingEvidence&&readings.some(r=>r.sqft!==null)?'readable':'uncertain'};
 });
}
export function discrepancy(entered,observed){
 if(!Number.isFinite(entered)||entered<=0||!Number.isFinite(observed)||observed<=0)return null;
 if(Math.abs(entered-observed)<=Math.max(PLAN_LIMITS.absoluteToleranceSqFt,observed*PLAN_LIMITS.relativeTolerance))return null;
 const ratio=entered/observed,near=n=>Math.abs(ratio-n)/n<.06;
 return{enteredSqFt:entered,planSqFt:observed,differenceSqFt:entered-observed,code:near(10)||near(.1)||near(100)||near(.01)?'possible-zero':near(10.7639104)||near(.09290304)?'possible-unit':'area-mismatch'};
}
export function comparePlanScope(claims,scope,{wholeProject=false,links={},geometryWarnings=0}={}){
 const conflicts=[],matches=[],rooms=claims.filter(c=>c.kind==='room'),used=new Set();
 if(!rooms.length)conflicts.push({id:'no-plan-rooms',code:'no-rooms-recognized',label:'Plan'});
 if(geometryWarnings)conflicts.push({id:'geometry-warnings',code:'discarded-plan-evidence',label:'Plan'});
 for(const claim of rooms){
  if(claim.areaSqFt===null||claim.conflictingEvidence)conflicts.push({id:'evidence-'+claim.id,claimId:claim.id,code:'uncertain-plan-reading',label:claim.label});
  if(scope.mode!=='room')continue;
  const candidates=scope.rooms.filter(r=>roomKey(r.name)===roomKey(claim.label));
  const duplicatePlan=rooms.filter(c=>roomKey(c.label)===roomKey(claim.label)).length>1;
  const target=links[claim.id]?scope.rooms.find(r=>r.id===links[claim.id]):candidates.length===1&&!duplicatePlan?candidates[0]:null;
  if(!target){conflicts.push({id:'mapping-'+claim.id,claimId:claim.id,code:'unmatched-plan-room',label:claim.label});continue;}
  if(used.has(target.id)){conflicts.push({id:'duplicate-'+claim.id,claimId:claim.id,code:'room-linked-twice',label:claim.label});continue;}
  used.add(target.id);const entered=target.measurement==='area'?target.area:target.length*target.width,diff=discrepancy(entered,claim.areaSqFt);
  matches.push({claimId:claim.id,roomId:target.id,enteredSqFt:entered,planSqFt:claim.areaSqFt});if(diff)conflicts.push({id:'area-'+claim.id,claimId:claim.id,roomId:target.id,label:claim.label,...diff});
 }
 if(scope.mode==='room')for(const room of scope.rooms)if(!used.has(room.id))conflicts.push({id:'input-'+scope.rooms.indexOf(room),roomId:room.id,code:'unmatched-entered-room',label:room.name});
 const completeMeasurements=rooms.length>0&&rooms.every(c=>c.areaSqFt!==null&&!c.conflictingEvidence);
 const total=rooms.reduce((sum,c)=>sum+(c.areaSqFt||0),0);
 if(scope.mode==='project'&&wholeProject&&completeMeasurements){const diff=discrepancy(scope.area,total);if(diff)conflicts.push({id:'project-total',code:diff.code,label:scope.name,...diff});}
 return{matches,conflicts,planRoomCount:rooms.length,printedRoomAreaSqFt:total,completeMeasurements,wholeProject,limits:'Pixel geometry and printed labels do not establish net cleanable area or prove that every room was recognized.'};
}

export function planScopeFingerprint(scope){
 const raw=JSON.stringify([scope.mode,scope.unit,scope.area,scope.gross,scope.common,scope.rooms.map(r=>[r.name,r.category,r.measurement,r.area,r.length,r.width])]);
 let hash=2166136261;for(let i=0;i<raw.length;i++)hash=Math.imul(hash^raw.charCodeAt(i),16777619);return 'scope-v1-'+(hash>>>0).toString(16);
}
export function reviewDecisionsValid(comparison,decisions){return comparison.conflicts.every(c=>decisions.some(d=>d.conflictId===c.id&&['partial-scope','discuss-on-call'].includes(d.resolution)&&typeof d.reason==='string'&&d.reason.trim().length>=8&&d.reason.length<=1000));}
