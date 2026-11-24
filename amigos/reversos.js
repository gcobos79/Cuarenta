/* V2.31: reversos navideños (diseño del nivel 1: pino). En Amigos no hay niveles, así que es siempre el mismo. */
(function(){
 var W="xmlns='http://www.w3.org/2000/svg'";
 function u(s){return 'url("data:image/svg+xml,'+encodeURIComponent(s).replace(/'/g,'%27')+'")'}
 function st(cx,cy,R,r,n){n=n||5;var p=[];for(var i=0;i<2*n;i++){var a=(-90+i*180/n)*Math.PI/180,q=i%2?r:R;p.push((cx+q*Math.cos(a)).toFixed(2)+','+(cy+q*Math.sin(a)).toFixed(2))}return 'M'+p.join(' L')+'Z'}
 function holly(x,y,s,f){return "<g transform='translate("+x+" "+y+") scale("+(f?-s:s)+" "+s+")'><path d='M0 0C4-4 9-3 12-7C11-2 14 0 12 3C8 2 4 4 0 0Z' fill='#2f7d55' stroke='#173d2b' stroke-width='.6'/><path d='M0 0C-1-5 2-9 0-13C4-10 6-11 7-8C5-5 4-2 0 0Z' fill='#3a8f62' stroke='#173d2b' stroke-width='.6'/><circle cx='1.5' cy='1.5' r='2' fill='#d62839'/><circle cx='-1.8' cy='-.5' r='1.8' fill='#c8202f'/><circle cx='.5' cy='-2.6' r='1.5' fill='#e0404f'/></g>"}
 var T1="<svg "+W+" width='24' height='24'><g stroke='#f3ead9' stroke-width='.9' stroke-linecap='round' opacity='.85'><path d='M7 3v8M3.5 5l7 4M3.5 9l7-4'/></g><circle cx='18' cy='17' r='1.1' fill='#d6bd8a'/><circle cx='18.5' cy='5' r='.7' fill='#f3ead9' opacity='.7'/><circle cx='5' cy='19' r='.6' fill='#f3ead9' opacity='.6'/></svg>";
 var orn=[[24,32,'#c8202f'],[37,40,'#e8b930'],[19,47,'#f3ead9'],[34,52,'#c8202f'],[44,58,'#e8b930'],[14,59,'#c8202f'],[28,60,'#f3ead9']];
 var M1="<svg "+W+" viewBox='0 0 60 84'><rect x='1' y='1' width='58' height='82' rx='6' fill='#1a2d28' stroke='#e7d4a0' stroke-width='1.6'/><rect x='4.5' y='4.5' width='51' height='75' rx='4' fill='none' stroke='#d6bd8a' stroke-width='.7' stroke-dasharray='2.2 1.8'/><g fill='#f3ead9' opacity='.8'><circle cx='10' cy='12' r='.9'/><circle cx='50' cy='18' r='.8'/><circle cx='47' cy='9' r='.6'/><circle cx='9' cy='34' r='.7'/><circle cx='52' cy='38' r='.9'/><circle cx='12' cy='24' r='.5'/></g><path d='M5 71Q17 65 30 69T55 66V79.5H5Z' fill='#f3ead9'/><rect x='27' y='63' width='6' height='7' fill='#7a5534'/><path d='M30 18L41 33H36L46 46H40L51 64H9L20 46H14L24 33H19Z' fill='#2f7d55' stroke='#d6bd8a' stroke-width='1.1' stroke-linejoin='round'/><path d='M23 36Q31 41 38 35M17 49Q30 56 43 48' fill='none' stroke='#e8b930' stroke-width='1.1' stroke-linecap='round'/>"
  +orn.map(function(o){return "<circle cx='"+o[0]+"' cy='"+o[1]+"' r='2.1' fill='"+o[2]+"' stroke='#1a2d28' stroke-width='.5'/>"}).join('')
  +"<path d='"+st(30,15,6.5,2.7)+"' fill='#f4d27a' stroke='#8a6410' stroke-width='.7'/></svg>";
 var M2="<svg "+W+" viewBox='0 0 60 84'><rect x='1' y='1' width='58' height='82' rx='6' fill='#f3ead9' stroke='#d6bd8a' stroke-width='1.6'/><rect x='4' y='4' width='52' height='76' rx='4' fill='#1f3a31' stroke='#b3202e' stroke-width='1.4'/><g fill='#d6bd8a' opacity='.55'><circle cx='12' cy='30' r='.8'/><circle cx='48' cy='28' r='.8'/><circle cx='15' cy='66' r='.8'/><circle cx='46' cy='68' r='.8'/></g><rect x='14' y='40' width='32' height='26' rx='1.5' fill='#c8202f' stroke='#7a1018' stroke-width='.8'/><rect x='12' y='34' width='36' height='8' rx='1.5' fill='#d62839' stroke='#7a1018' stroke-width='.8'/><rect x='27' y='34' width='6' height='32' fill='#e8b930' stroke='#8a6410' stroke-width='.5'/><path d='M30 34C22 22 14 28 21 33C24 35 28 34 30 34ZM30 34C38 22 46 28 39 33C36 35 32 34 30 34Z' fill='#e8b930' stroke='#8a6410' stroke-width='.8'/><circle cx='30' cy='33.5' r='2.4' fill='#f4d27a' stroke='#8a6410' stroke-width='.6'/><path d='M28 36L24 45M32 36L36 45' stroke='#8a6410' stroke-width='.6' fill='none'/>"
  +holly(13,16,.95)+holly(47,16,.95,1)+holly(13,75,.8)+holly(47,75,.8,1)+"</svg>";
 var T3="<svg "+W+" width='30' height='30'><path d='"+st(8,8,3.4,.9,4)+"' fill='#e8c472'/><circle cx='22' cy='21' r='.9' fill='#f3ead9' opacity='.85'/><circle cx='23' cy='6' r='.6' fill='#d6bd8a'/><path d='"+st(14,24,1.8,.5,4)+"' fill='#d6bd8a' opacity='.8'/><circle cx='4' cy='19' r='.5' fill='#f3ead9' opacity='.6'/></svg>";
 var wr='',i,a,x,y,cols=['#2f7d55','#3a8f62','#24694a'];
 for(i=0;i<22;i++){a=i*360/22;x=(30+17*Math.cos(a*Math.PI/180)).toFixed(1);y=(44+17*Math.sin(a*Math.PI/180)).toFixed(1);wr+="<ellipse cx='"+x+"' cy='"+y+"' rx='5.2' ry='2.4' transform='rotate("+Math.round(a+90+(i%2?25:-25))+" "+x+" "+y+")' fill='"+cols[i%3]+"' stroke='#123824' stroke-width='.4'/>"}
 for(i=0;i<8;i++){a=(i*45+20)*Math.PI/180;wr+="<circle cx='"+(30+18*Math.cos(a)).toFixed(1)+"' cy='"+(44+18*Math.sin(a)).toFixed(1)+"' r='1.7' fill='#d62839' stroke='#6d0f17' stroke-width='.4'/>";a=(i*45+42)*Math.PI/180;wr+="<circle cx='"+(30+14*Math.cos(a)).toFixed(1)+"' cy='"+(44+14*Math.sin(a)).toFixed(1)+"' r='1.1' fill='#f4d27a'/>"}
 for(i=0;i<12;i++){a=i*30*Math.PI/180;wr+="<line x1='30' y1='44' x2='"+(30+11*Math.cos(a)).toFixed(1)+"' y2='"+(44+11*Math.sin(a)).toFixed(1)+"' stroke='#f4d27a' stroke-width='.5' opacity='.6'/>"}
 var M3="<svg "+W+" viewBox='0 0 60 84'><defs><radialGradient id='v' cx='50%' cy='45%' r='65%'><stop offset='0' stop-color='#a51d2c'/><stop offset='1' stop-color='#5c0e18'/></radialGradient><radialGradient id='g'><stop offset='0' stop-color='#fff4c9' stop-opacity='.9'/><stop offset='1' stop-color='#f4d27a' stop-opacity='0'/></radialGradient></defs><rect x='1' y='1' width='58' height='82' rx='6' fill='url(#v)' stroke='#e7d4a0' stroke-width='1.6'/><rect x='4' y='4' width='52' height='76' rx='4' fill='none' stroke='#d6bd8a' stroke-width='.8'/><rect x='6' y='6' width='48' height='72' rx='3' fill='none' stroke='#d6bd8a' stroke-width='.4' stroke-dasharray='1 1.6'/>"
  +[[11,11],[49,11],[11,73],[49,73]].map(function(p){return "<path d='"+st(p[0],p[1],2.2,.6,4)+"' fill='#f4d27a'/>"}).join('')
  +"<path d='M30 7V19' stroke='#d6bd8a' stroke-width='.6'/><circle cx='30' cy='44' r='11' fill='url(#g)'/>"+wr
  +"<path d='M30 63C23 57 18 63 22 67C25 69 28 66 30 63ZM30 63C37 57 42 63 38 67C35 69 32 66 30 63Z' fill='#d62839' stroke='#6d0f17' stroke-width='.6'/><path d='M29 64L25 76L28 74L29 77ZM31 64L35 76L32 74L31 77Z' fill='#c8202f' stroke='#6d0f17' stroke-width='.5'/><circle cx='30' cy='63.5' r='2' fill='#e8b930' stroke='#8a6410' stroke-width='.5'/>"
  +"<path d='"+st(30,44,8,3.3)+"' fill='#f4d27a' stroke='#8a6410' stroke-width='.7'/><path d='"+st(30,44,3.5,1.4)+"' fill='#fff4c9'/></svg>";
 var CANE='repeating-linear-gradient(45deg,#243b35 0 5px,#d6bd8a 5px 6px,#b3202e 6px 11px,#f3ead9 11px 12px)';
 var B1=u(T1)+' 0 0/22px 22px,radial-gradient(ellipse at 50% 40%,#2c4a42,#1c312b)',B3=u(T3)+' 0 0/26px 26px,linear-gradient(160deg,#1d3a33,#0e1f1c 70%,#14182a)';
 var L='body[data-xmas-lvl',P=' #pile0 .capture-card,',Q=' #pile1 .capture-card';
 var css=L+'] .card.back:after{content:""!important;border:0!important;width:66%;height:70%;background:center/100% 100% no-repeat;filter:drop-shadow(0 1px 2px #0007)}'
  +L+'="1"] .card.back{background:'+B1+'!important;border-color:#eee0c2!important;box-shadow:0 6px 12px #0009,inset 0 0 0 2px #b3202e}'
  +L+'="1"] .card.back:after{background-image:'+u(M1)+'!important}'
  +L+'="2"] .card.back{background:'+CANE+'!important;border-color:#f3ead9!important;box-shadow:0 6px 12px #0009,inset 0 0 0 2px #d6bd8a}'
  +L+'="2"] .card.back:after{background-image:'+u(M2)+'!important}'
  +L+'="3"] .card.back{background:'+B3+'!important;border-color:#d6bd8a!important;box-shadow:0 6px 12px #0009,0 0 10px #f4d27a55,inset 0 0 0 2px #9e1c28,inset 0 0 0 3px #d6bd8a}'
  +L+'="3"] .card.back:after{background-image:'+u(M3)+'!important}'
  +'@media(prefers-reduced-motion:no-preference){'+L+'="3"] .card.back:after{animation:xmasGlow 3.2s ease-in-out infinite}}'
  +'@keyframes xmasGlow{0%,100%{filter:drop-shadow(0 1px 2px #0007)}50%{filter:drop-shadow(0 0 6px #f4d27aaa)}}'
  +L+'="1"]'+P+L+'="1"]'+Q+'{background:'+B1+'!important}'
  +L+'="2"]'+P+L+'="2"]'+Q+'{background:'+CANE+'!important}'
  +L+'="3"]'+P+L+'="3"]'+Q+'{background:'+B3+'!important}'
  +'@media (max-width:600px) and (pointer:coarse),(orientation:landscape) and (max-height:520px) and (pointer:fine){'+L+']'+P+L+']'+Q+'{background:none!important}}';
 var el=document.createElement('style');el.id='xmasBacks';el.textContent=css;document.head.appendChild(el);
 document.body.dataset.xmasLvl='1';
})();
