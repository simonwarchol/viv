import{i as te}from"./pako.esm-147cf1d7.js";import{g as se,B as le,L as oe,a as re}from"./index-7b56775a.js";var ie={exports:{}};(function($){/* Copyright 2015-2021 Esri. Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 @preserve */(function(){var Y=function(){var F={};F.defaultNoDataValue=-34027999387901484e22,F.decode=function(r,o){o=o||{};var a=o.encodedMaskData||o.encodedMaskData===null,i=t(r,o.inputOffset||0,a),m=o.noDataValue!==null?o.noDataValue:F.defaultNoDataValue,n=A(i,o.pixelType||Float32Array,o.encodedMaskData,m,o.returnMask),f={width:i.width,height:i.height,pixelData:n.resultPixels,minValue:n.minValue,maxValue:i.pixels.maxValue,noDataValue:m};return n.resultMask&&(f.maskData=n.resultMask),o.returnEncodedMask&&i.mask&&(f.encodedMaskData=i.mask.bitset?i.mask.bitset:null),o.returnFileInfo&&(f.fileInfo=X(i),o.computeUsedBitDepths&&(f.fileInfo.bitDepths=R(i))),f};var A=function(r,o,a,i,m){var n=0,f=r.pixels.numBlocksX,v=r.pixels.numBlocksY,u=Math.floor(r.width/f),h=Math.floor(r.height/v),g=2*r.maxZError,l=Number.MAX_VALUE,s;a=a||(r.mask?r.mask.bitset:null);var w,k;w=new o(r.width*r.height),m&&a&&(k=new Uint8Array(r.width*r.height));for(var D=new Float32Array(u*h),d,y,x=0;x<=v;x++){var L=x!==v?h:r.height%v;if(L!==0)for(var p=0;p<=f;p++){var c=p!==f?u:r.width%f;if(c!==0){var U=x*r.width*h+p*u,I=r.width-c,M=r.pixels.blocks[n],T,V,S;M.encoding<2?(M.encoding===0?T=M.rawData:(e(M.stuffedData,M.bitsPerPixel,M.numValidPixels,M.offset,g,D,r.pixels.maxValue),T=D),V=0):M.encoding===2?S=0:S=M.offset;var B;if(a)for(y=0;y<L;y++){for(U&7&&(B=a[U>>3],B<<=U&7),d=0;d<c;d++)U&7||(B=a[U>>3]),B&128?(k&&(k[U]=1),s=M.encoding<2?T[V++]:S,l=l>s?s:l,w[U++]=s):(k&&(k[U]=0),w[U++]=i),B<<=1;U+=I}else if(M.encoding<2)for(y=0;y<L;y++){for(d=0;d<c;d++)s=T[V++],l=l>s?s:l,w[U++]=s;U+=I}else for(l=l>S?S:l,y=0;y<L;y++){for(d=0;d<c;d++)w[U++]=S;U+=I}if(M.encoding===1&&V!==M.numValidPixels)throw"Block and Mask do not match";n++}}}return{resultPixels:w,resultMask:k,minValue:l}},X=function(r){return{fileIdentifierString:r.fileIdentifierString,fileVersion:r.fileVersion,imageType:r.imageType,height:r.height,width:r.width,maxZError:r.maxZError,eofOffset:r.eofOffset,mask:r.mask?{numBlocksX:r.mask.numBlocksX,numBlocksY:r.mask.numBlocksY,numBytes:r.mask.numBytes,maxValue:r.mask.maxValue}:null,pixels:{numBlocksX:r.pixels.numBlocksX,numBlocksY:r.pixels.numBlocksY,numBytes:r.pixels.numBytes,maxValue:r.pixels.maxValue,noDataValue:r.noDataValue}}},R=function(r){for(var o=r.pixels.numBlocksX*r.pixels.numBlocksY,a={},i=0;i<o;i++){var m=r.pixels.blocks[i];m.encoding===0?a.float32=!0:m.encoding===1?a[m.bitsPerPixel]=!0:a[0]=!0}return Object.keys(a)},t=function(r,o,a){var i={},m=new Uint8Array(r,o,10);if(i.fileIdentifierString=String.fromCharCode.apply(null,m),i.fileIdentifierString.trim()!=="CntZImage")throw"Unexpected file identifier string: "+i.fileIdentifierString;o+=10;var n=new DataView(r,o,24);if(i.fileVersion=n.getInt32(0,!0),i.imageType=n.getInt32(4,!0),i.height=n.getUint32(8,!0),i.width=n.getUint32(12,!0),i.maxZError=n.getFloat64(16,!0),o+=24,!a)if(n=new DataView(r,o,16),i.mask={},i.mask.numBlocksY=n.getUint32(0,!0),i.mask.numBlocksX=n.getUint32(4,!0),i.mask.numBytes=n.getUint32(8,!0),i.mask.maxValue=n.getFloat32(12,!0),o+=16,i.mask.numBytes>0){var f=new Uint8Array(Math.ceil(i.width*i.height/8));n=new DataView(r,o,i.mask.numBytes);var v=n.getInt16(0,!0),u=2,h=0;do{if(v>0)for(;v--;)f[h++]=n.getUint8(u++);else{var g=n.getUint8(u++);for(v=-v;v--;)f[h++]=g}v=n.getInt16(u,!0),u+=2}while(u<i.mask.numBytes);if(v!==-32768||h<f.length)throw"Unexpected end of mask RLE encoding";i.mask.bitset=f,o+=i.mask.numBytes}else i.mask.numBytes|i.mask.numBlocksY|i.mask.maxValue||(i.mask.bitset=new Uint8Array(Math.ceil(i.width*i.height/8)));n=new DataView(r,o,16),i.pixels={},i.pixels.numBlocksY=n.getUint32(0,!0),i.pixels.numBlocksX=n.getUint32(4,!0),i.pixels.numBytes=n.getUint32(8,!0),i.pixels.maxValue=n.getFloat32(12,!0),o+=16;var l=i.pixels.numBlocksX,s=i.pixels.numBlocksY,w=l+(i.width%l>0?1:0),k=s+(i.height%s>0?1:0);i.pixels.blocks=new Array(w*k);for(var D=0,d=0;d<k;d++)for(var y=0;y<w;y++){var x=0,L=r.byteLength-o;n=new DataView(r,o,Math.min(10,L));var p={};i.pixels.blocks[D++]=p;var c=n.getUint8(0);if(x++,p.encoding=c&63,p.encoding>3)throw"Invalid block encoding ("+p.encoding+")";if(p.encoding===2){o++;continue}if(c!==0&&c!==2){if(c>>=6,p.offsetType=c,c===2)p.offset=n.getInt8(1),x++;else if(c===1)p.offset=n.getInt16(1,!0),x+=2;else if(c===0)p.offset=n.getFloat32(1,!0),x+=4;else throw"Invalid block offset type";if(p.encoding===1)if(c=n.getUint8(x),x++,p.bitsPerPixel=c&63,c>>=6,p.numValidPixelsType=c,c===2)p.numValidPixels=n.getUint8(x),x++;else if(c===1)p.numValidPixels=n.getUint16(x,!0),x+=2;else if(c===0)p.numValidPixels=n.getUint32(x,!0),x+=4;else throw"Invalid valid pixel count type"}if(o+=x,p.encoding!==3){var U,I;if(p.encoding===0){var M=(i.pixels.numBytes-1)/4;if(M!==Math.floor(M))throw"uncompressed block has invalid length";U=new ArrayBuffer(M*4),I=new Uint8Array(U),I.set(new Uint8Array(r,o,M*4));var T=new Float32Array(U);p.rawData=T,o+=M*4}else if(p.encoding===1){var V=Math.ceil(p.numValidPixels*p.bitsPerPixel/8),S=Math.ceil(V/4);U=new ArrayBuffer(S*4),I=new Uint8Array(U),I.set(new Uint8Array(r,o,V)),p.stuffedData=new Uint32Array(U),o+=V}}}return i.eofOffset=o,i},e=function(r,o,a,i,m,n,f){var v=(1<<o)-1,u=0,h,g=0,l,s,w=Math.ceil((f-i)/m),k=r.length*4-Math.ceil(o*a/8);for(r[r.length-1]<<=8*k,h=0;h<a;h++){if(g===0&&(s=r[u++],g=32),g>=o)l=s>>>g-o&v,g-=o;else{var D=o-g;l=(s&v)<<D&v,s=r[u++],g=32-D,l+=s>>>g}n[h]=l<w?i+l*m:f}return n};return F}(),K=function(){var F={unstuff:function(t,e,r,o,a,i,m,n){var f=(1<<r)-1,v=0,u,h=0,g,l,s,w,k=t.length*4-Math.ceil(r*o/8);if(t[t.length-1]<<=8*k,a)for(u=0;u<o;u++)h===0&&(l=t[v++],h=32),h>=r?(g=l>>>h-r&f,h-=r):(s=r-h,g=(l&f)<<s&f,l=t[v++],h=32-s,g+=l>>>h),e[u]=a[g];else for(w=Math.ceil((n-i)/m),u=0;u<o;u++)h===0&&(l=t[v++],h=32),h>=r?(g=l>>>h-r&f,h-=r):(s=r-h,g=(l&f)<<s&f,l=t[v++],h=32-s,g+=l>>>h),e[u]=g<w?i+g*m:n},unstuffLUT:function(t,e,r,o,a,i){var m=(1<<e)-1,n=0,f=0,v=0,u=0,h=0,g,l=[],s=t.length*4-Math.ceil(e*r/8);t[t.length-1]<<=8*s;var w=Math.ceil((i-o)/a);for(f=0;f<r;f++)u===0&&(g=t[n++],u=32),u>=e?(h=g>>>u-e&m,u-=e):(v=e-u,h=(g&m)<<v&m,g=t[n++],u=32-v,h+=g>>>u),l[f]=h<w?o+h*a:i;return l.unshift(o),l},unstuff2:function(t,e,r,o,a,i,m,n){var f=(1<<r)-1,v=0,u,h=0,g=0,l,s,w;if(a)for(u=0;u<o;u++)h===0&&(s=t[v++],h=32,g=0),h>=r?(l=s>>>g&f,h-=r,g+=r):(w=r-h,l=s>>>g&f,s=t[v++],h=32-w,l|=(s&(1<<w)-1)<<r-w,g=w),e[u]=a[l];else{var k=Math.ceil((n-i)/m);for(u=0;u<o;u++)h===0&&(s=t[v++],h=32,g=0),h>=r?(l=s>>>g&f,h-=r,g+=r):(w=r-h,l=s>>>g&f,s=t[v++],h=32-w,l|=(s&(1<<w)-1)<<r-w,g=w),e[u]=l<k?i+l*m:n}return e},unstuffLUT2:function(t,e,r,o,a,i){var m=(1<<e)-1,n=0,f=0,v=0,u=0,h=0,g=0,l,s=[],w=Math.ceil((i-o)/a);for(f=0;f<r;f++)u===0&&(l=t[n++],u=32,g=0),u>=e?(h=l>>>g&m,u-=e,g+=e):(v=e-u,h=l>>>g&m,l=t[n++],u=32-v,h|=(l&(1<<v)-1)<<e-v,g=v),s[f]=h<w?o+h*a:i;return s.unshift(o),s},originalUnstuff:function(t,e,r,o){var a=(1<<r)-1,i=0,m,n=0,f,v,u,h=t.length*4-Math.ceil(r*o/8);for(t[t.length-1]<<=8*h,m=0;m<o;m++)n===0&&(v=t[i++],n=32),n>=r?(f=v>>>n-r&a,n-=r):(u=r-n,f=(v&a)<<u&a,v=t[i++],n=32-u,f+=v>>>n),e[m]=f;return e},originalUnstuff2:function(t,e,r,o){var a=(1<<r)-1,i=0,m,n=0,f=0,v,u,h;for(m=0;m<o;m++)n===0&&(u=t[i++],n=32,f=0),n>=r?(v=u>>>f&a,n-=r,f+=r):(h=r-n,v=u>>>f&a,u=t[i++],n=32-h,v|=(u&(1<<h)-1)<<r-h,f=h),e[m]=v;return e}},A={HUFFMAN_LUT_BITS_MAX:12,computeChecksumFletcher32:function(t){for(var e=65535,r=65535,o=t.length,a=Math.floor(o/2),i=0;a;){var m=a>=359?359:a;a-=m;do e+=t[i++]<<8,r+=e+=t[i++];while(--m);e=(e&65535)+(e>>>16),r=(r&65535)+(r>>>16)}return o&1&&(r+=e+=t[i]<<8),e=(e&65535)+(e>>>16),r=(r&65535)+(r>>>16),(r<<16|e)>>>0},readHeaderInfo:function(t,e){var r=e.ptr,o=new Uint8Array(t,r,6),a={};if(a.fileIdentifierString=String.fromCharCode.apply(null,o),a.fileIdentifierString.lastIndexOf("Lerc2",0)!==0)throw"Unexpected file identifier string (expect Lerc2 ): "+a.fileIdentifierString;r+=6;var i=new DataView(t,r,8),m=i.getInt32(0,!0);a.fileVersion=m,r+=4,m>=3&&(a.checksum=i.getUint32(4,!0),r+=4),i=new DataView(t,r,12),a.height=i.getUint32(0,!0),a.width=i.getUint32(4,!0),r+=8,m>=4?(a.numDims=i.getUint32(8,!0),r+=4):a.numDims=1,i=new DataView(t,r,40),a.numValidPixel=i.getUint32(0,!0),a.microBlockSize=i.getInt32(4,!0),a.blobSize=i.getInt32(8,!0),a.imageType=i.getInt32(12,!0),a.maxZError=i.getFloat64(16,!0),a.zMin=i.getFloat64(24,!0),a.zMax=i.getFloat64(32,!0),r+=40,e.headerInfo=a,e.ptr=r;var n,f;if(m>=3&&(f=m>=4?52:48,n=this.computeChecksumFletcher32(new Uint8Array(t,r-f,a.blobSize-14)),n!==a.checksum))throw"Checksum failed.";return!0},checkMinMaxRanges:function(t,e){var r=e.headerInfo,o=this.getDataTypeArray(r.imageType),a=r.numDims*this.getDataTypeSize(r.imageType),i=this.readSubArray(t,e.ptr,o,a),m=this.readSubArray(t,e.ptr+a,o,a);e.ptr+=2*a;var n,f=!0;for(n=0;n<r.numDims;n++)if(i[n]!==m[n]){f=!1;break}return r.minValues=i,r.maxValues=m,f},readSubArray:function(t,e,r,o){var a;if(r===Uint8Array)a=new Uint8Array(t,e,o);else{var i=new ArrayBuffer(o),m=new Uint8Array(i);m.set(new Uint8Array(t,e,o)),a=new r(i)}return a},readMask:function(t,e){var r=e.ptr,o=e.headerInfo,a=o.width*o.height,i=o.numValidPixel,m=new DataView(t,r,4),n={};if(n.numBytes=m.getUint32(0,!0),r+=4,(i===0||a===i)&&n.numBytes!==0)throw"invalid mask";var f,v;if(i===0)f=new Uint8Array(Math.ceil(a/8)),n.bitset=f,v=new Uint8Array(a),e.pixels.resultMask=v,r+=n.numBytes;else if(n.numBytes>0){f=new Uint8Array(Math.ceil(a/8)),m=new DataView(t,r,n.numBytes);var u=m.getInt16(0,!0),h=2,g=0,l=0;do{if(u>0)for(;u--;)f[g++]=m.getUint8(h++);else for(l=m.getUint8(h++),u=-u;u--;)f[g++]=l;u=m.getInt16(h,!0),h+=2}while(h<n.numBytes);if(u!==-32768||g<f.length)throw"Unexpected end of mask RLE encoding";v=new Uint8Array(a);var s=0,w=0;for(w=0;w<a;w++)w&7?(s=f[w>>3],s<<=w&7):s=f[w>>3],s&128&&(v[w]=1);e.pixels.resultMask=v,n.bitset=f,r+=n.numBytes}return e.ptr=r,e.mask=n,!0},readDataOneSweep:function(t,e,r,o){var a=e.ptr,i=e.headerInfo,m=i.numDims,n=i.width*i.height,f=i.imageType,v=i.numValidPixel*A.getDataTypeSize(f)*m,u,h=e.pixels.resultMask;if(r===Uint8Array)u=new Uint8Array(t,a,v);else{var g=new ArrayBuffer(v),l=new Uint8Array(g);l.set(new Uint8Array(t,a,v)),u=new r(g)}if(u.length===n*m)o?e.pixels.resultPixels=A.swapDimensionOrder(u,n,m,r,!0):e.pixels.resultPixels=u;else{e.pixels.resultPixels=new r(n*m);var s=0,w=0,k=0,D=0;if(m>1){if(o){for(w=0;w<n;w++)if(h[w])for(D=w,k=0;k<m;k++,D+=n)e.pixels.resultPixels[D]=u[s++]}else for(w=0;w<n;w++)if(h[w])for(D=w*m,k=0;k<m;k++)e.pixels.resultPixels[D+k]=u[s++]}else for(w=0;w<n;w++)h[w]&&(e.pixels.resultPixels[w]=u[s++])}return a+=v,e.ptr=a,!0},readHuffmanTree:function(t,e){var r=this.HUFFMAN_LUT_BITS_MAX,o=new DataView(t,e.ptr,16);e.ptr+=16;var a=o.getInt32(0,!0);if(a<2)throw"unsupported Huffman version";var i=o.getInt32(4,!0),m=o.getInt32(8,!0),n=o.getInt32(12,!0);if(m>=n)return!1;var f=new Uint32Array(n-m);A.decodeBits(t,e,f);var v=[],u,h,g,l;for(u=m;u<n;u++)h=u-(u<i?0:i),v[h]={first:f[u-m],second:null};var s=t.byteLength-e.ptr,w=Math.ceil(s/4),k=new ArrayBuffer(w*4),D=new Uint8Array(k);D.set(new Uint8Array(t,e.ptr,s));var d=new Uint32Array(k),y=0,x,L=0;for(x=d[0],u=m;u<n;u++)h=u-(u<i?0:i),l=v[h].first,l>0&&(v[h].second=x<<y>>>32-l,32-y>=l?(y+=l,y===32&&(y=0,L++,x=d[L])):(y+=l-32,L++,x=d[L],v[h].second|=x>>>32-y));var p=0,c=0,U=new X;for(u=0;u<v.length;u++)v[u]!==void 0&&(p=Math.max(p,v[u].first));p>=r?c=r:c=p;var I=[],M,T,V,S,B,C;for(u=m;u<n;u++)if(h=u-(u<i?0:i),l=v[h].first,l>0)if(M=[l,h],l<=c)for(T=v[h].second<<c-l,V=1<<c-l,g=0;g<V;g++)I[T|g]=M;else for(T=v[h].second,C=U,S=l-1;S>=0;S--)B=T>>>S&1,B?(C.right||(C.right=new X),C=C.right):(C.left||(C.left=new X),C=C.left),S===0&&!C.val&&(C.val=M[1]);return{decodeLut:I,numBitsLUTQick:c,numBitsLUT:p,tree:U,stuffedData:d,srcPtr:L,bitPos:y}},readHuffman:function(t,e,r,o){var a=e.headerInfo,i=a.numDims,m=e.headerInfo.height,n=e.headerInfo.width,f=n*m,v=this.readHuffmanTree(t,e),u=v.decodeLut,h=v.tree,g=v.stuffedData,l=v.srcPtr,s=v.bitPos,w=v.numBitsLUTQick,k=v.numBitsLUT,D=e.headerInfo.imageType===0?128:0,d,y,x,L=e.pixels.resultMask,p,c,U,I,M,T,V,S=0;s>0&&(l++,s=0);var B=g[l],C=e.encodeMode===1,j=new r(f*i),O=j,b;if(i<2||C){for(b=0;b<i;b++)if(i>1&&(O=new r(j.buffer,f*b,f),S=0),e.headerInfo.numValidPixel===n*m)for(T=0,I=0;I<m;I++)for(M=0;M<n;M++,T++){if(y=0,p=B<<s>>>32-w,c=p,32-s<w&&(p|=g[l+1]>>>64-s-w,c=p),u[c])y=u[c][1],s+=u[c][0];else for(p=B<<s>>>32-k,c=p,32-s<k&&(p|=g[l+1]>>>64-s-k,c=p),d=h,V=0;V<k;V++)if(U=p>>>k-V-1&1,d=U?d.right:d.left,!(d.left||d.right)){y=d.val,s=s+V+1;break}s>=32&&(s-=32,l++,B=g[l]),x=y-D,C?(M>0?x+=S:I>0?x+=O[T-n]:x+=S,x&=255,O[T]=x,S=x):O[T]=x}else for(T=0,I=0;I<m;I++)for(M=0;M<n;M++,T++)if(L[T]){if(y=0,p=B<<s>>>32-w,c=p,32-s<w&&(p|=g[l+1]>>>64-s-w,c=p),u[c])y=u[c][1],s+=u[c][0];else for(p=B<<s>>>32-k,c=p,32-s<k&&(p|=g[l+1]>>>64-s-k,c=p),d=h,V=0;V<k;V++)if(U=p>>>k-V-1&1,d=U?d.right:d.left,!(d.left||d.right)){y=d.val,s=s+V+1;break}s>=32&&(s-=32,l++,B=g[l]),x=y-D,C?(M>0&&L[T-1]?x+=S:I>0&&L[T-n]?x+=O[T-n]:x+=S,x&=255,O[T]=x,S=x):O[T]=x}}else for(T=0,I=0;I<m;I++)for(M=0;M<n;M++)if(T=I*n+M,!L||L[T])for(b=0;b<i;b++,T+=f){if(y=0,p=B<<s>>>32-w,c=p,32-s<w&&(p|=g[l+1]>>>64-s-w,c=p),u[c])y=u[c][1],s+=u[c][0];else for(p=B<<s>>>32-k,c=p,32-s<k&&(p|=g[l+1]>>>64-s-k,c=p),d=h,V=0;V<k;V++)if(U=p>>>k-V-1&1,d=U?d.right:d.left,!(d.left||d.right)){y=d.val,s=s+V+1;break}s>=32&&(s-=32,l++,B=g[l]),x=y-D,O[T]=x}e.ptr=e.ptr+(l+1)*4+(s>0?4:0),e.pixels.resultPixels=j,i>1&&!o&&(e.pixels.resultPixels=A.swapDimensionOrder(j,f,i,r))},decodeBits:function(t,e,r,o,a){{var i=e.headerInfo,m=i.fileVersion,n=0,f=t.byteLength-e.ptr>=5?5:t.byteLength-e.ptr,v=new DataView(t,e.ptr,f),u=v.getUint8(0);n++;var h=u>>6,g=h===0?4:3-h,l=(u&32)>0,s=u&31,w=0;if(g===1)w=v.getUint8(n),n++;else if(g===2)w=v.getUint16(n,!0),n+=2;else if(g===4)w=v.getUint32(n,!0),n+=4;else throw"Invalid valid pixel count type";var k=2*i.maxZError,D,d,y,x,L,p,c,U,I,M=i.numDims>1?i.maxValues[a]:i.zMax;if(l){for(e.counter.lut++,U=v.getUint8(n),n++,x=Math.ceil((U-1)*s/8),L=Math.ceil(x/4),d=new ArrayBuffer(L*4),y=new Uint8Array(d),e.ptr+=n,y.set(new Uint8Array(t,e.ptr,x)),c=new Uint32Array(d),e.ptr+=x,I=0;U-1>>>I;)I++;x=Math.ceil(w*I/8),L=Math.ceil(x/4),d=new ArrayBuffer(L*4),y=new Uint8Array(d),y.set(new Uint8Array(t,e.ptr,x)),D=new Uint32Array(d),e.ptr+=x,m>=3?p=F.unstuffLUT2(c,s,U-1,o,k,M):p=F.unstuffLUT(c,s,U-1,o,k,M),m>=3?F.unstuff2(D,r,I,w,p):F.unstuff(D,r,I,w,p)}else e.counter.bitstuffer++,I=s,e.ptr+=n,I>0&&(x=Math.ceil(w*I/8),L=Math.ceil(x/4),d=new ArrayBuffer(L*4),y=new Uint8Array(d),y.set(new Uint8Array(t,e.ptr,x)),D=new Uint32Array(d),e.ptr+=x,m>=3?o==null?F.originalUnstuff2(D,r,I,w):F.unstuff2(D,r,I,w,!1,o,k,M):o==null?F.originalUnstuff(D,r,I,w):F.unstuff(D,r,I,w,!1,o,k,M))}},readTiles:function(t,e,r,o){var a=e.headerInfo,i=a.width,m=a.height,n=i*m,f=a.microBlockSize,v=a.imageType,u=A.getDataTypeSize(v),h=Math.ceil(i/f),g=Math.ceil(m/f);e.pixels.numBlocksY=g,e.pixels.numBlocksX=h,e.pixels.ptr=0;var l=0,s=0,w=0,k=0,D=0,d=0,y=0,x=0,L=0,p=0,c=0,U=0,I=0,M=0,T=0,V=0,S,B,C,j,O,b,Q=new r(f*f),ne=m%f||f,ae=i%f||f,G,H,q=a.numDims,_,E=e.pixels.resultMask,z=e.pixels.resultPixels,fe=a.fileVersion,ee=fe>=5?14:15,Z,J=a.zMax,N;for(w=0;w<g;w++)for(D=w!==g-1?f:ne,k=0;k<h;k++)for(d=k!==h-1?f:ae,c=w*i*f+k*f,U=i-d,_=0;_<q;_++){if(q>1?(N=z,c=w*i*f+k*f,z=new r(e.pixels.resultPixels.buffer,n*_*u,n),J=a.maxValues[_]):N=null,y=t.byteLength-e.ptr,S=new DataView(t,e.ptr,Math.min(10,y)),B={},V=0,x=S.getUint8(0),V++,Z=a.fileVersion>=5?x&4:0,L=x>>6&255,p=x>>2&ee,p!==(k*f>>3&ee)||Z&&_===0)throw"integrity issue";if(b=x&3,b>3)throw e.ptr+=V,"Invalid block encoding ("+b+")";if(b===2){if(Z)if(E)for(l=0;l<D;l++)for(s=0;s<d;s++)E[c]&&(z[c]=N[c]),c++;else for(l=0;l<D;l++)for(s=0;s<d;s++)z[c]=N[c],c++;e.counter.constant++,e.ptr+=V;continue}else if(b===0){if(Z)throw"integrity issue";if(e.counter.uncompressed++,e.ptr+=V,I=D*d*u,M=t.byteLength-e.ptr,I=I<M?I:M,C=new ArrayBuffer(I%u===0?I:I+u-I%u),j=new Uint8Array(C),j.set(new Uint8Array(t,e.ptr,I)),O=new r(C),T=0,E)for(l=0;l<D;l++){for(s=0;s<d;s++)E[c]&&(z[c]=O[T++]),c++;c+=U}else for(l=0;l<D;l++){for(s=0;s<d;s++)z[c++]=O[T++];c+=U}e.ptr+=T*u}else if(G=A.getDataTypeUsed(Z&&v<6?4:v,L),H=A.getOnePixel(B,V,G,S),V+=A.getDataTypeSize(G),b===3)if(e.ptr+=V,e.counter.constantoffset++,E)for(l=0;l<D;l++){for(s=0;s<d;s++)E[c]&&(z[c]=Z?Math.min(J,N[c]+H):H),c++;c+=U}else for(l=0;l<D;l++){for(s=0;s<d;s++)z[c]=Z?Math.min(J,N[c]+H):H,c++;c+=U}else if(e.ptr+=V,A.decodeBits(t,e,Q,H,_),V=0,Z)if(E)for(l=0;l<D;l++){for(s=0;s<d;s++)E[c]&&(z[c]=Q[V++]+N[c]),c++;c+=U}else for(l=0;l<D;l++){for(s=0;s<d;s++)z[c]=Q[V++]+N[c],c++;c+=U}else if(E)for(l=0;l<D;l++){for(s=0;s<d;s++)E[c]&&(z[c]=Q[V++]),c++;c+=U}else for(l=0;l<D;l++){for(s=0;s<d;s++)z[c++]=Q[V++];c+=U}}q>1&&!o&&(e.pixels.resultPixels=A.swapDimensionOrder(e.pixels.resultPixels,n,q,r))},formatFileInfo:function(t){return{fileIdentifierString:t.headerInfo.fileIdentifierString,fileVersion:t.headerInfo.fileVersion,imageType:t.headerInfo.imageType,height:t.headerInfo.height,width:t.headerInfo.width,numValidPixel:t.headerInfo.numValidPixel,microBlockSize:t.headerInfo.microBlockSize,blobSize:t.headerInfo.blobSize,maxZError:t.headerInfo.maxZError,pixelType:A.getPixelType(t.headerInfo.imageType),eofOffset:t.eofOffset,mask:t.mask?{numBytes:t.mask.numBytes}:null,pixels:{numBlocksX:t.pixels.numBlocksX,numBlocksY:t.pixels.numBlocksY,maxValue:t.headerInfo.zMax,minValue:t.headerInfo.zMin,noDataValue:t.noDataValue}}},constructConstantSurface:function(t,e){var r=t.headerInfo.zMax,o=t.headerInfo.zMin,a=t.headerInfo.maxValues,i=t.headerInfo.numDims,m=t.headerInfo.height*t.headerInfo.width,n=0,f=0,v=0,u=t.pixels.resultMask,h=t.pixels.resultPixels;if(u)if(i>1){if(e)for(n=0;n<i;n++)for(v=n*m,r=a[n],f=0;f<m;f++)u[f]&&(h[v+f]=r);else for(f=0;f<m;f++)if(u[f])for(v=f*i,n=0;n<i;n++)h[v+i]=a[n]}else for(f=0;f<m;f++)u[f]&&(h[f]=r);else if(i>1&&o!==r)if(e)for(n=0;n<i;n++)for(v=n*m,r=a[n],f=0;f<m;f++)h[v+f]=r;else for(f=0;f<m;f++)for(v=f*i,n=0;n<i;n++)h[v+n]=a[n];else for(f=0;f<m*i;f++)h[f]=r},getDataTypeArray:function(t){var e;switch(t){case 0:e=Int8Array;break;case 1:e=Uint8Array;break;case 2:e=Int16Array;break;case 3:e=Uint16Array;break;case 4:e=Int32Array;break;case 5:e=Uint32Array;break;case 6:e=Float32Array;break;case 7:e=Float64Array;break;default:e=Float32Array}return e},getPixelType:function(t){var e;switch(t){case 0:e="S8";break;case 1:e="U8";break;case 2:e="S16";break;case 3:e="U16";break;case 4:e="S32";break;case 5:e="U32";break;case 6:e="F32";break;case 7:e="F64";break;default:e="F32"}return e},isValidPixelValue:function(t,e){if(e==null)return!1;var r;switch(t){case 0:r=e>=-128&&e<=127;break;case 1:r=e>=0&&e<=255;break;case 2:r=e>=-32768&&e<=32767;break;case 3:r=e>=0&&e<=65536;break;case 4:r=e>=-2147483648&&e<=2147483647;break;case 5:r=e>=0&&e<=4294967296;break;case 6:r=e>=-34027999387901484e22&&e<=34027999387901484e22;break;case 7:r=e>=-17976931348623157e292&&e<=17976931348623157e292;break;default:r=!1}return r},getDataTypeSize:function(t){var e=0;switch(t){case 0:case 1:e=1;break;case 2:case 3:e=2;break;case 4:case 5:case 6:e=4;break;case 7:e=8;break;default:e=t}return e},getDataTypeUsed:function(t,e){var r=t;switch(t){case 2:case 4:r=t-e;break;case 3:case 5:r=t-2*e;break;case 6:e===0?r=t:e===1?r=2:r=1;break;case 7:e===0?r=t:r=t-2*e+1;break;default:r=t;break}return r},getOnePixel:function(t,e,r,o){var a=0;switch(r){case 0:a=o.getInt8(e);break;case 1:a=o.getUint8(e);break;case 2:a=o.getInt16(e,!0);break;case 3:a=o.getUint16(e,!0);break;case 4:a=o.getInt32(e,!0);break;case 5:a=o.getUInt32(e,!0);break;case 6:a=o.getFloat32(e,!0);break;case 7:a=o.getFloat64(e,!0);break;default:throw"the decoder does not understand this pixel type"}return a},swapDimensionOrder:function(t,e,r,o,a){var i=0,m=0,n=0,f=0,v=t;if(r>1)if(v=new o(e*r),a)for(i=0;i<e;i++)for(f=i,n=0;n<r;n++,f+=e)v[f]=t[m++];else for(i=0;i<e;i++)for(f=i,n=0;n<r;n++,f+=e)v[m++]=t[f];return v}},X=function(t,e,r){this.val=t,this.left=e,this.right=r},R={decode:function(t,e){e=e||{};var r=e.noDataValue,o=0,a={};if(a.ptr=e.inputOffset||0,a.pixels={},!!A.readHeaderInfo(t,a)){var i=a.headerInfo,m=i.fileVersion,n=A.getDataTypeArray(i.imageType);if(m>5)throw"unsupported lerc version 2."+m;A.readMask(t,a),i.numValidPixel!==i.width*i.height&&!a.pixels.resultMask&&(a.pixels.resultMask=e.maskData);var f=i.width*i.height;a.pixels.resultPixels=new n(f*i.numDims),a.counter={onesweep:0,uncompressed:0,lut:0,bitstuffer:0,constant:0,constantoffset:0};var v=!e.returnPixelInterleavedDims;if(i.numValidPixel!==0)if(i.zMax===i.zMin)A.constructConstantSurface(a,v);else if(m>=4&&A.checkMinMaxRanges(t,a))A.constructConstantSurface(a,v);else{var u=new DataView(t,a.ptr,2),h=u.getUint8(0);if(a.ptr++,h)A.readDataOneSweep(t,a,n,v);else if(m>1&&i.imageType<=1&&Math.abs(i.maxZError-.5)<1e-5){var g=u.getUint8(1);if(a.ptr++,a.encodeMode=g,g>2||m<4&&g>1)throw"Invalid Huffman flag "+g;g?A.readHuffman(t,a,n,v):A.readTiles(t,a,n,v)}else A.readTiles(t,a,n,v)}a.eofOffset=a.ptr;var l;e.inputOffset?(l=a.headerInfo.blobSize+e.inputOffset-a.ptr,Math.abs(l)>=1&&(a.eofOffset=e.inputOffset+a.headerInfo.blobSize)):(l=a.headerInfo.blobSize-a.ptr,Math.abs(l)>=1&&(a.eofOffset=a.headerInfo.blobSize));var s={width:i.width,height:i.height,pixelData:a.pixels.resultPixels,minValue:i.zMin,maxValue:i.zMax,validPixelCount:i.numValidPixel,dimCount:i.numDims,dimStats:{minValues:i.minValues,maxValues:i.maxValues},maskData:a.pixels.resultMask};if(a.pixels.resultMask&&A.isValidPixelValue(i.imageType,r)){var w=a.pixels.resultMask;for(o=0;o<f;o++)w[o]||(s.pixelData[o]=r);s.noDataValue=r}return a.noDataValue=r,e.returnFileInfo&&(s.fileInfo=A.formatFileInfo(a)),s}},getBandCount:function(t){var e=0,r=0,o={};for(o.ptr=0,o.pixels={};r<t.byteLength-58;)A.readHeaderInfo(t,o),r+=o.headerInfo.blobSize,e++,o.ptr=r;return e}};return R}(),W=function(){var F=new ArrayBuffer(4),A=new Uint8Array(F),X=new Uint32Array(F);return X[0]=1,A[0]===1}(),P={decode:function(F,A){if(!W)throw"Big endian system is not supported.";A=A||{};var X=A.inputOffset||0,R=new Uint8Array(F,X,10),t=String.fromCharCode.apply(null,R),e,r;if(t.trim()==="CntZImage")e=Y,r=1;else if(t.substring(0,5)==="Lerc2")e=K,r=2;else throw"Unexpected file identifier string: "+t;for(var o=0,a=F.byteLength-10,i,m=[],n,f,v={width:0,height:0,pixels:[],pixelType:A.pixelType,mask:null,statistics:[]},u=0;X<a;){var h=e.decode(F,{inputOffset:X,encodedMaskData:i,maskData:f,returnMask:o===0,returnEncodedMask:o===0,returnFileInfo:!0,returnPixelInterleavedDims:A.returnPixelInterleavedDims,pixelType:A.pixelType||null,noDataValue:A.noDataValue||null});X=h.fileInfo.eofOffset,f=h.maskData,o===0&&(i=h.encodedMaskData,v.width=h.width,v.height=h.height,v.dimCount=h.dimCount||1,v.pixelType=h.pixelType||h.fileInfo.pixelType,v.mask=f),r>1&&(f&&m.push(f),h.fileInfo.mask&&h.fileInfo.mask.numBytes>0&&u++),o++,v.pixels.push(h.pixelData),v.statistics.push({minValue:h.minValue,maxValue:h.maxValue,noDataValue:h.noDataValue,dimStats:h.dimStats})}var g,l,s;if(r>1&&u>1){for(s=v.width*v.height,v.bandMasks=m,f=new Uint8Array(s),f.set(m[0]),g=1;g<m.length;g++)for(n=m[g],l=0;l<s;l++)f[l]=f[l]&n[l];v.maskData=f}return v}};$.exports?$.exports=P:this.Lerc=P})()})(ie);var ue=ie.exports;const ve=se(ue);class ce extends le{constructor(Y){super(),this.planarConfiguration=typeof Y.PlanarConfiguration<"u"?Y.PlanarConfiguration:1,this.samplesPerPixel=typeof Y.SamplesPerPixel<"u"?Y.SamplesPerPixel:1,this.addCompression=Y.LercParameters[oe.AddCompression]}decodeBlock(Y){switch(this.addCompression){case re.None:break;case re.Deflate:Y=te(new Uint8Array(Y)).buffer;break;default:throw new Error(`Unsupported LERC additional compression method identifier: ${this.addCompression}`)}return ve.decode(Y,{returnPixelInterleavedDims:this.planarConfiguration===1}).pixels[0].buffer}}export{ce as default};
