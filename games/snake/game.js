(function () {
  "use strict";
  const canvas = document.querySelector("#game"), context = canvas.getContext("2d"), $ = (s) => document.querySelector(s), sound = (n) => window.PocketSound?.play(n);
  const COLS = 20, ROWS = 28, CELL = 18;
  const vectors = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
  let snake, food, direction, queued, score, state, wrap = false, elapsed = 0, last = 0;
  let high = Number(localStorage.getItem("pp-snake-hi") || 0);

  function reset() {
    snake = [{x:10,y:14},{x:9,y:14},{x:8,y:14}];
    direction = null; queued = null; score = 0; state = "ready"; elapsed = 0;
    placeFood(); sync(); $("#status").textContent = "十字をタップ、または矢印キーでスタート";
  }
  function placeFood() {
    do { food = {x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)}; }
    while (snake?.some((part) => part.x === food.x && part.y === food.y));
  }
  function level() { return 1 + Math.floor(score / 50); }
  function interval() { return Math.max(55, 155 - (level()-1)*10); }
  function sync() {
    $("#score").textContent=String(score).padStart(4,"0"); $("#high").textContent=`HI ${String(high).padStart(4,"0")}`;
    $("#level").textContent=`LEVEL ${String(level()).padStart(2,"0")}`; $("#mode").textContent=wrap?"WRAP":"WALL";
  }
  function steer(next) {
    if (state === "over") return;
    const [nx,ny]=vectors[next], current=queued||direction;
    if (current) { const [cx,cy]=vectors[current]; if (nx===-cx&&ny===-cy) return; }
    queued=next;
    if (state === "ready") { state="playing"; $("#status").textContent="エサを集めよう"; }
  }
  function step() {
    if (state !== "playing" || !direction && !queued) return;
    if (queued) { direction=queued; queued=null; }
    const [dx,dy]=vectors[direction]; let head={x:snake[0].x+dx,y:snake[0].y+dy};
    if (wrap) { head.x=(head.x+COLS)%COLS; head.y=(head.y+ROWS)%ROWS; }
    const wall=head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS;
    const body=snake.some((part,index)=>index<snake.length-1&&part.x===head.x&&part.y===head.y);
    if (wall||body) { state="over"; $("#status").textContent="GAME OVER — STARTをタップ、またはSで再開"; sound("lose"); return; }
    snake.unshift(head);
    if (head.x===food.x&&head.y===food.y) { score+=10; high=Math.max(high,score); localStorage.setItem("pp-snake-hi",high); placeFood(); sound("coin"); }
    else snake.pop();
    sync();
  }
  function draw() {
    context.clearRect(0,0,360,504); context.strokeStyle="rgba(37,57,39,.08)";
    for(let x=0;x<=COLS;x++){context.beginPath();context.moveTo(x*CELL,0);context.lineTo(x*CELL,504);context.stroke()}
    for(let y=0;y<=ROWS;y++){context.beginPath();context.moveTo(0,y*CELL);context.lineTo(360,y*CELL);context.stroke()}
    context.fillStyle="#9a3c45";context.fillRect(food.x*CELL+4,food.y*CELL+4,10,10);
    snake.forEach((part,index)=>{context.fillStyle=index===0?"#253927":"#526f4e";context.fillRect(part.x*CELL+1,part.y*CELL+1,16,16)});
    if(state==="paused"){context.fillStyle="rgba(37,57,39,.85)";context.fillRect(70,215,220,65);context.fillStyle="#c7dfa0";context.font="bold 22px monospace";context.fillText("PAUSE",145,255)}
  }
  function loop(time) { const delta=Math.min(50,time-last||0);last=time;if(state==="playing"){elapsed+=delta;if(elapsed>=interval()){elapsed%=interval();step()}}draw();requestAnimationFrame(loop); }
  document.addEventListener("pocket-input",(event)=>{const action=event.detail.action;if(vectors[action])steer(action);else if(action==="a"){if(state==="playing"){elapsed=0;step()}}else if(action==="select"&&["ready","over"].includes(state)){wrap=!wrap;sync()}else if(action==="start"){if(state==="over")reset();else if(state==="playing")state="paused";else if(state==="paused")state="playing"}else if(action==="b")location.href="../../"});
  reset();requestAnimationFrame(loop);
})();
