(function(){
  'use strict';const A=window.Atelier;
  function drawingSvg(scale=100){
    const f=A.floor(),bounds=A.planBounds(A.floor()),pad=100,minX=bounds.minX-pad,minY=bounds.minY-pad;
    const width=Math.max(500,bounds.maxX-bounds.minX+pad*2),height=Math.max(400,bounds.maxY-bounds.minY+pad*2+180),esc=A.escapeHtml;
    const line=(x1,y1,x2,y2,attrs='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`;
    let content='';
    f.rooms.forEach(r=>{content+=r.polygon?`<polygon points="${r.polygon.map(p=>`${p.x},${p.y}`).join(' ')}" fill="${esc(r.color||'#eee')}" stroke="#aaa"/>`:`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.d}" fill="${esc(r.color||'#eee')}" stroke="#aaa"/>`;content+=`<text x="${r.x+r.w/2}" y="${r.y+r.d/2}" text-anchor="middle" font-size="22">${esc(r.name)}<tspan x="${r.x+r.w/2}" dy="28">${esc(A.formatArea(A.roomArea(r)))}</tspan></text>`;});
    f.walls.forEach(w=>{content+=line(w.x1,w.y1,w.x2,w.y2,`stroke="#36443e" stroke-width="${w.thickness}" stroke-linecap="square"`);});
    f.items.filter(A.isRoofVisibleInPlan).forEach(o=>{if(A.isServiceRoute?.(o)){content+=`<polyline points="${A.serviceWorldPoints(o).map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="${esc(o.color)}" stroke-width="${Math.max(2,o.diameter||2)}" stroke-linejoin="round"/><text x="${o.x}" y="${o.y-12}" font-size="14">${esc(o.name)} ${esc(o.circuit||'')} · ${esc(A.formatLength(A.serviceLength(o)))}</text>`;return;}const cx=o.x+o.w/2,cy=o.y+o.d/2;content+=`<g transform="rotate(${o.rotation||0} ${cx} ${cy})"><rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.d}" fill="${esc(o.color||'#ddd')}" fill-opacity=".7" stroke="#566b60" stroke-width="2"/><text x="${cx}" y="${cy}" font-size="14" text-anchor="middle">${esc(o.name||o.type)}</text></g>`;});
    if(A.state.project.showStructure!==false){(f.columns||[]).forEach(c=>content+=`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.d}" fill="#43554c"/>`);(f.beams||[]).forEach(b=>content+=line(b.x1,b.y1,b.x2,b.y2,`stroke="#788c82" stroke-width="${b.width}" stroke-dasharray="12 8"`));}
    f.dimensions.forEach(d=>{content+=line(d.x1,d.y1,d.x2,d.y2,'stroke="#425f50" stroke-width="2"');content+=`<text x="${(d.x1+d.x2)/2}" y="${(d.y1+d.y2)/2-12}" text-anchor="middle" font-size="22">${esc(A.formatLength(Math.hypot(d.x2-d.x1,d.y2-d.y1)))}</text>`;});
    const top=minY+65,nx=minX+width-75;content+=`<g transform="rotate(${A.state.project.north||0} ${nx} ${top})">${line(nx,top+40,nx,top-30,'stroke="#244e39" stroke-width="4"')}<path d="M${nx-12} ${top-10} L${nx} ${top-35} L${nx+12} ${top-10}" fill="none" stroke="#244e39" stroke-width="4"/></g><text x="${nx}" y="${top-45}" text-anchor="middle" font-size="25">N</text>`;
    const titleY=minY+height-130;content+=`<rect x="${minX+20}" y="${titleY}" width="${width-40}" height="110" fill="white" stroke="#78857e" stroke-width="2"/><text x="${minX+40}" y="${titleY+32}" font-size="28">${esc(A.state.project.name)} · ${esc(f.name)}</text><text x="${minX+40}" y="${titleY+62}" font-size="20">Atelier Plan · Scale 1:${scale} at original print size · ${new Date().toLocaleDateString()}</text><text x="${minX+40}" y="${titleY+88}" font-size="18">Concept drawing · dimensions use ${esc(A.unitLabel())} · verify before construction</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width*10/scale}mm" height="${height*10/scale}mm" viewBox="${minX} ${minY} ${width} ${height}" style="background:white;font-family:Arial,sans-serif"><title>${esc(A.state.project.name)} — ${esc(f.name)}</title>${content}</svg>`;
  }
  function exportDrawing(){const scale=Number(A.$('#drawingScale').value),svg=drawingSvg(scale),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),link=document.createElement('a');link.href=url;link.download='atelier-plan-'+scale+'.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);A.showToast('Scaled SVG drawing exported');}
  function buildDrawingPdf(jpeg,widthPt,heightPt,pixelWidth,pixelHeight){
    const encoder=new TextEncoder(),chunks=[],offsets=[0];let length=0;
    const push=value=>{const bytes=typeof value==='string'?encoder.encode(value):value;chunks.push(bytes);length+=bytes.length;};
    const object=(id,body)=>{offsets[id]=length;push(`${id} 0 obj\n${body}\nendobj\n`);};
    push('%PDF-1.4\n');object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    object(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] /Resources << /XObject << /Drawing 5 0 R >> >> /Contents 4 0 R >>`);
    const commands=`q ${widthPt} 0 0 ${heightPt} 0 0 cm /Drawing Do Q\n`;
    object(4,`<< /Length ${commands.length} >>\nstream\n${commands}endstream`);
    offsets[5]=length;push(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);push(jpeg);push('\nendstream\nendobj\n');
    const xref=length;push('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)push(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const bytes=new Uint8Array(length);let cursor=0;for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.length;}return bytes;
  }
  async function drawingPdf(scale=100){
    const svg=drawingSvg(scale),documentSvg=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;
    const widthMm=parseFloat(documentSvg.getAttribute('width')),heightMm=parseFloat(documentSvg.getAttribute('height'));
    const resolution=Math.min(150/25.4,4096/Math.max(widthMm,heightMm)),canvas=document.createElement('canvas');canvas.width=Math.ceil(widthMm*resolution);canvas.height=Math.ceil(heightMm*resolution);
    const context=canvas.getContext('2d'),image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Could not render this drawing'));image.src=url;});context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      const jpeg=Uint8Array.from(atob(canvas.toDataURL('image/jpeg',.95).split(',')[1]),char=>char.charCodeAt(0));
      return buildDrawingPdf(jpeg,widthMm*72/25.4,heightMm*72/25.4,canvas.width,canvas.height);
    }finally{URL.revokeObjectURL(url);}
  }
  async function exportPdfDrawing(){try{const scale=Number(A.$('#drawingScale').value),bytes=await drawingPdf(scale),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');link.href=url;link.download=`atelier-plan-${scale}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);A.showToast('Scaled PDF drawing exported');}catch(error){A.showToast(error.message);}}
  function printDrawing(){const svg=drawingSvg(Number(A.$('#drawingScale').value)),panel=A.$('#drawingPrint');panel.innerHTML=svg;document.body.classList.add('printing-drawing');window.addEventListener('afterprint',()=>document.body.classList.remove('printing-drawing'),{once:true});window.print();}
  Object.assign(A,{drawingSvg,exportDrawing,printDrawing,drawingPdf,exportPdfDrawing});
})();
