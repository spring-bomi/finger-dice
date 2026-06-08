const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = {}; 
let gameState = 'lobby'; 

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        if (name === 'DISPLAY') {
            socket.join('display'); 
        } else {
            // ⭐ 게임이 로비(대기) 상태이거나 결과 공개 상태일 때만 즉시 참여(active: true)
            // 게임 도중(input_fingers, betting)에 들어오면 이번 판은 관전(active: false)
            const isActive = (gameState === 'lobby' || gameState === 'reveal');
            
            players[socket.id] = { name: name, fingers: null, betTotal: null, score: 0, active: isActive };
            io.emit('updatePlayers', players);
            
            // 중간에 들어온 사람의 화면을 맞추기 위해 현재 상태 개별 전송
            socket.emit('phaseChange', gameState, players);
        }
    });

    socket.on('startGame', () => {
        gameState = 'input_fingers';
        for (let id in players) {
            players[id].fingers = null;
            players[id].betTotal = null;
            players[id].active = true; // ⭐ 새 라운드 시작 시 관전자 포함 모두를 참여자로 변경
        }
        io.emit('phaseChange', gameState, players);
    });

    socket.on('submitFingers', (num) => {
        if (players[socket.id] && players[socket.id].active) {
            players[socket.id].fingers = num;
            io.to('display').emit('playerUpdated', players);

            // ⭐ '이번 라운드 참여자(active)'들만 체크
            const activePlayers = Object.values(players).filter(p => p.active);
            const allSubmitted = activePlayers.every(p => p.fingers !== null);
            
            if (allSubmitted && activePlayers.length > 0) {
                gameState = 'betting';
                io.emit('phaseChange', gameState, players);
            }
        }
    });

    socket.on('submitBet', (predictedTotal) => {
        if (players[socket.id] && players[socket.id].active) {
            players[socket.id].betTotal = predictedTotal;
            io.to('display').emit('playerUpdated', players);

            const activePlayers = Object.values(players).filter(p => p.active);
            const allBet = activePlayers.every(p => p.betTotal !== null);
            
            if (allBet && activePlayers.length > 0) {
                gameState = 'reveal';
                const trueTotal = activePlayers.reduce((sum, p) => sum + p.fingers, 0);
                
                for (let id in players) {
                    if (players[id].active && players[id].betTotal === trueTotal) {
                        players[id].score += 1;
                    }
                }
                io.emit('revealResult', { players, trueTotal });
            }
        }
    });

    // ⭐ 중간에 나갔을 때 게임이 멈추는 현상 방지
    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
        
        const activePlayers = Object.values(players).filter(p => p.active);
        
        if (activePlayers.length > 0) {
            if (gameState === 'input_fingers' && activePlayers.every(p => p.fingers !== null)) {
                gameState = 'betting';
                io.emit('phaseChange', gameState, players);
            } else if (gameState === 'betting' && activePlayers.every(p => p.betTotal !== null)) {
                gameState = 'reveal';
                const trueTotal = activePlayers.reduce((sum, p) => sum + p.fingers, 0);
                for (let id in players) {
                    if (players[id].active && players[id].betTotal === trueTotal) {
                        players[id].score += 1;
                    }
                }
                io.emit('revealResult', { players, trueTotal });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`핑거 주사위 서버가 ${PORT}포트에서 실행 중입니다.`);
});
