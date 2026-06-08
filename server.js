const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = {}; 
let gameState = 'lobby'; 
let roundMode = 'score'; // 'score'(점수제) 또는 'betting'(베팅제)

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        if (name === 'DISPLAY') {
            socket.join('display'); 
        } else {
            const isActive = (gameState === 'lobby' || gameState === 'reveal');
            // ⭐ 베팅을 위해 초기 자본금 100 지급, betAmount 추가
            players[socket.id] = { name: name, fingers: null, betTotal: null, betAmount: 0, score: 100, active: isActive };
            io.emit('updatePlayers', players, roundMode);
            socket.emit('phaseChange', gameState, players, roundMode);
        }
    });

    // ⭐ 게임 시작 시 모드(점수제/베팅제)를 전달받음
    socket.on('startGame', (mode) => {
        gameState = 'input_fingers';
        roundMode = mode || 'score';
        
        for (let id in players) {
            players[id].fingers = null;
            players[id].betTotal = null;
            players[id].betAmount = 0;
            players[id].active = true; 
        }
        io.emit('phaseChange', gameState, players, roundMode);
    });

    socket.on('submitFingers', (num) => {
        if (players[socket.id] && players[socket.id].active) {
            players[socket.id].fingers = num;
            io.to('display').emit('playerUpdated', players, roundMode);

            const activePlayers = Object.values(players).filter(p => p.active);
            const allSubmitted = activePlayers.every(p => p.fingers !== null);
            
            if (allSubmitted && activePlayers.length > 0) {
                gameState = 'betting';
                io.emit('phaseChange', gameState, players, roundMode);
            }
        }
    });

    // ⭐ 예측 총합과 베팅 금액을 함께 받음
    socket.on('submitBet', (data) => {
        if (players[socket.id] && players[socket.id].active) {
            players[socket.id].betTotal = data.total;
            players[socket.id].betAmount = data.amount || 0;
            
            io.to('display').emit('playerUpdated', players, roundMode);

            const activePlayers = Object.values(players).filter(p => p.active);
            const allBet = activePlayers.every(p => p.betTotal !== null);
            
            if (allBet && activePlayers.length > 0) {
                gameState = 'reveal';
                const trueTotal = activePlayers.reduce((sum, p) => sum + p.fingers, 0);
                
                // ⭐ 모드별 점수/칩 정산 로직
                for (let id in players) {
                    if (players[id].active) {
                        const p = players[id];
                        if (roundMode === 'score') {
                            if (p.betTotal === trueTotal) p.score += 1; // 점수제: 맞추면 +1점
                        } else if (roundMode === 'betting') {
                            if (p.betTotal === trueTotal) {
                                p.score += p.betAmount * 2; // 베팅제: 맞추면 베팅액의 2배 수익 (총 3배당)
                            } else {
                                p.score -= p.betAmount; // 틀리면 베팅액 몰수
                            }
                        }
                    }
                }
                io.emit('revealResult', { players, trueTotal, roundMode });
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players, roundMode);
        
        const activePlayers = Object.values(players).filter(p => p.active);
        if (activePlayers.length > 0) {
            if (gameState === 'input_fingers' && activePlayers.every(p => p.fingers !== null)) {
                gameState = 'betting';
                io.emit('phaseChange', gameState, players, roundMode);
            } else if (gameState === 'betting' && activePlayers.every(p => p.betTotal !== null)) {
                gameState = 'reveal';
                const trueTotal = activePlayers.reduce((sum, p) => sum + p.fingers, 0);
                
                for (let id in players) {
                    if (players[id].active) {
                        if (roundMode === 'score' && players[id].betTotal === trueTotal) {
                            players[id].score += 1;
                        } else if (roundMode === 'betting') {
                            if (players[id].betTotal === trueTotal) players[id].score += players[id].betAmount * 2;
                            else players[id].score -= players[id].betAmount;
                        }
                    }
                }
                io.emit('revealResult', { players, trueTotal, roundMode });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`서버가 ${PORT}포트에서 실행 중입니다.`); });
