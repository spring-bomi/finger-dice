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
            // ⭐ score: 0 (점수 데이터 추가)
            players[socket.id] = { name: name, fingers: null, betTotal: null, score: 0 };
            io.emit('updatePlayers', players);
        }
    });

    socket.on('startGame', () => {
        gameState = 'input_fingers';
        for (let id in players) {
            players[id].fingers = null;
            players[id].betTotal = null;
            // 점수(score)는 초기화하지 않고 그대로 유지합니다.
        }
        io.emit('phaseChange', gameState);
    });

    socket.on('submitFingers', (num) => {
        if (players[socket.id]) players[socket.id].fingers = num;
        io.to('display').emit('playerUpdated', players);

        const allSubmitted = Object.values(players).every(p => p.fingers !== null);
        if (allSubmitted && Object.keys(players).length > 0) {
            gameState = 'betting';
            io.emit('phaseChange', gameState);
        }
    });

    socket.on('submitBet', (predictedTotal) => {
        if (players[socket.id]) players[socket.id].betTotal = predictedTotal;
        io.to('display').emit('playerUpdated', players);

        const allBet = Object.values(players).every(p => p.betTotal !== null);
        if (allBet && Object.keys(players).length > 0) {
            gameState = 'reveal';
            
            // 실제 손가락 총합 계산
            const trueTotal = Object.values(players).reduce((sum, p) => sum + p.fingers, 0);
            
            // ⭐ 정답자 점수 1점 증가 로직 추가
            for (let id in players) {
                if (players[id].betTotal === trueTotal) {
                    players[id].score += 1;
                }
            }
            
            io.emit('revealResult', { players, trueTotal });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`핑거 주사위 서버가 ${PORT}포트에서 실행 중입니다.`);
});
