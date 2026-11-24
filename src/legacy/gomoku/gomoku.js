import { runtime } from '../runtime/state.js'
import { controls } from '../runtime/state.js'

export async function toggleGomokuBoard() {
            if (!runtime.state.activeChatId) return;
            const chatId = runtime.state.activeChatId;
            const overlay = document.getElementById('gomoku-overlay');
        
            
            if (!overlay.classList.contains('visible')) {
                const header = document.querySelector('#chat-interface-screen > .header');
                
                overlay.style.top = `${header.offsetHeight}px`;
                overlay.style.display = 'block';
        
                if (!runtime.gomokuState[chatId] || !runtime.gomokuState[chatId].isActive) {
                    initGomokuGame(chatId);
                }
                renderGomokuBoard(chatId);
        
                
                setTimeout(async () => {
                    overlay.classList.add('visible');
        
                    const startMessage = {
                        role: 'system',
                        content: '[System notice: The user opened the Gomoku board. The game has started.]',
                        timestamp: Date.now(),
                        isHidden: true
                    };
                    runtime.state.chats[chatId].history.push(startMessage);
                    await runtime.db.chats.put(runtime.state.chats[chatId]);
                }, 10);
        
            } else {
                
                await closeGomokuBoard();
            }
        }

export async function closeGomokuBoard() {
            if (!runtime.state.activeChatId) return;
            const chatId = runtime.state.activeChatId;
            const overlay = document.getElementById('gomoku-overlay');
            
            overlay.classList.remove('visible');
            
            
        
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        
            if (runtime.gomokuState[chatId]) {
                runtime.gomokuState[chatId].isActive = false;
                
                const endMessage = {
                    role: 'system',
                    content: '[System notice: The user closed the Gomoku board. The game has ended.]',
                    timestamp: Date.now(),
                    isHidden: true
                };
                runtime.state.chats[chatId].history.push(endMessage);
                await runtime.db.chats.put(runtime.state.chats[chatId]);
            }
        }

export function initGomokuGame(chatId) {
            const canvas = document.getElementById('gomoku-board');
            const overlay = document.getElementById('gomoku-overlay');
            const controls = document.getElementById('gomoku-controls');
            
            
            const availableWidth = overlay.offsetWidth - 40; 
            const availableHeight = overlay.offsetHeight - controls.offsetHeight - 40;
            const boardSize = Math.floor(Math.min(availableWidth, availableHeight));
            
            const GRID_SIZE = 15;
            
            const cell_size = Math.floor(boardSize / GRID_SIZE);
            const final_size = cell_size * GRID_SIZE;
            
            canvas.width = final_size;
            canvas.height = final_size;
        
            runtime.gomokuState[chatId] = {
                isActive: true,
                board: Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0)),
                currentPlayer: 1, 
                history: [],
                isGameOver: false,
                GRID_SIZE: GRID_SIZE,
                CELL_SIZE: cell_size
            };
        }

export function renderGomokuBoard(chatId) {
            const gameState = runtime.gomokuState[chatId];
            if (!gameState) return;
            
            const canvas = document.getElementById('gomoku-board');
            const ctx = canvas.getContext('2d');
            const { GRID_SIZE, CELL_SIZE } = gameState;
            const padding = CELL_SIZE / 2;
        
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#e4b591';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        
            
            ctx.strokeStyle = '#5b3a29';
            ctx.lineWidth = 1;
            for (let i = 0; i < GRID_SIZE; i++) {
                
                ctx.beginPath();
                ctx.moveTo(padding, padding + i * CELL_SIZE);
                ctx.lineTo(canvas.width - padding, padding + i * CELL_SIZE);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(padding + i * CELL_SIZE, padding);
                ctx.lineTo(padding + i * CELL_SIZE, canvas.height - padding);
                ctx.stroke();
            }
        
            
            for (let y = 0; y < GRID_SIZE; y++) {
                for (let x = 0; x < GRID_SIZE; x++) {
                    if (gameState.board[y][x] !== 0) {
                        drawStone(ctx, x, y, gameState.board[y][x], gameState);
                    }
                }
            }
        }

export function drawStone(ctx, x, y, player, gameState) {
            const { CELL_SIZE } = gameState;
            const padding = CELL_SIZE / 2;
            const radius = CELL_SIZE / 2 - 2;
        
            ctx.beginPath();
            ctx.arc(padding + x * CELL_SIZE, padding + y * CELL_SIZE, radius, 0, 2 * Math.PI);
            
            if (player === 1) { 
                ctx.fillStyle = 'black';
            } else { 
                ctx.fillStyle = 'white';
            }
            ctx.fill();
        }

export function handleBoardHover(e) {
            const chatId = runtime.state.activeChatId;
            const gameState = runtime.gomokuState[chatId];
            if (!gameState || gameState.isGameOver || gameState.currentPlayer !== 1) return;
        
            const canvas = document.getElementById('gomoku-board');
            const ctx = canvas.getContext('2d');
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
        
            const gridX = Math.round((x - gameState.CELL_SIZE / 2) / gameState.CELL_SIZE);
            const gridY = Math.round((y - gameState.CELL_SIZE / 2) / gameState.CELL_SIZE);
        
            renderGomokuBoard(chatId); 
        
            if (gridX >= 0 && gridX < gameState.GRID_SIZE && gridY >= 0 && gridY < gameState.GRID_SIZE && gameState.board[gridY][gridX] === 0) {
                const radius = gameState.CELL_SIZE / 2 - 2;
                ctx.beginPath();
                ctx.arc(gameState.CELL_SIZE / 2 + gridX * gameState.CELL_SIZE, gameState.CELL_SIZE / 2 + gridY * gameState.CELL_SIZE, radius, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; 
                ctx.fill();
            }
        }

export function handleBoardClick(e) {
            const chatId = runtime.state.activeChatId;
            const gameState = runtime.gomokuState[chatId];
            if (!gameState || gameState.isGameOver || gameState.currentPlayer !== 1) return;
        
            const canvas = document.getElementById('gomoku-board');
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
        
            const gridX = Math.round((x - gameState.CELL_SIZE / 2) / gameState.CELL_SIZE);
            const gridY = Math.round((y - gameState.CELL_SIZE / 2) / gameState.CELL_SIZE);
        
            if (gridX >= 0 && gridX < gameState.GRID_SIZE && gridY >= 0 && gridY < gameState.GRID_SIZE && gameState.board[gridY][gridX] === 0) {
                
                gameState.board[gridY][gridX] = 1;
                gameState.history.push({ x: gridX, y: gridY, player: 1 });
                renderGomokuBoard(chatId);
        
                
                if (checkWin(gridX, gridY, 1, gameState)) {
                    gameState.isGameOver = true;
                    setTimeout(() => alert("You won!"), 100);
            
            addGameEndSystemMessage('user'); 
              

                } else {
                    gameState.currentPlayer = 2; 
                    
                }
            }
        }

export function handleAiGomokuMove(move, isForcedMove = false) {
            const chatId = runtime.state.activeChatId;
            const gameState = runtime.gomokuState[chatId];
            
            
            if (!gameState || gameState.isGameOver) return;
            if (!isForcedMove && gameState.currentPlayer !== 2) return;

            const { x, y } = move;
        
            if (x >= 0 && x < gameState.GRID_SIZE && y >= 0 && y < gameState.GRID_SIZE && gameState.board[y][x] === 0) {
                gameState.board[y][x] = 2; 
                gameState.history.push({ x, y, player: 2 });
                renderGomokuBoard(chatId); 
        
                if (checkWin(x, y, 2, gameState)) {
                    gameState.isGameOver = true;
                    setTimeout(() => alert("The AI won!"), 100);
                    addGameEndSystemMessage('ai');
                } else {
                    gameState.currentPlayer = 1; 
                }
            } else {
                console.warn("AI 的下棋指令无效或位置已被占据:", move);
                
                gameState.currentPlayer = 1;
            }
        }

export function checkWin(x, y, player, gameState) {
            const { board, GRID_SIZE } = gameState;
            const directions = [[1, 0], [0, 1], [1, 1], [1, -1]]; 
            for (const [dx, dy] of directions) {
                let count = 1;
                
                for (let i = 1; i < 5; i++) {
                    const newX = x + i * dx;
                    const newY = y + i * dy;
                    if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE && board[newY][newX] === player) {
                        count++;
                    } else {
                        break;
                    }
                }
                
                for (let i = 1; i < 5; i++) {
                    const newX = x - i * dx;
                    const newY = y - i * dy;
                    if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE && board[newY][newX] === player) {
                        count++;
                    } else {
                        break;
                    }
                }
                if (count >= 5) return true;
            }
            return false;
        }

export function formatGomokuStateForAI(gameState) {
    if (!gameState || !gameState.isActive) return "";
    
    let boardString = "Board (1 = user/black, 2 = character/white):\n";
    boardString += gameState.board.map(row => row.join(' ')).join('\n');
    
    let historyString = "Move history (zero-based x and y coordinates):\n";
    historyString += gameState.history.map(move => `Player ${move.player} played (${move.x}, ${move.y})`).join(' -> ');
   
    return `
# Current Gomoku position
${boardString}

# ${historyString}

# Gomoku rules (highest priority)
- Play only on a cell marked 0. A cell marked 1 or 2 is occupied. Five matching stones in a row horizontally, vertically, or diagonally wins.
- Check the user's four-in-a-row and open-three threats. Look for blocks. Check your own immediate win, open four, or double-three opportunities. Weigh offense and defense before choosing.
- A clever or competitive character should play the best move. An absent-minded character, or one taking it easy, may play a weaker move if it does not let the user win immediately. Otherwise choose a reasonable move that fits your persona.
- React to the move in character and in the language of the conversation.

## Output
Return only a JSON array with your move and one line of commentary. Each coordinate must be an integer from 0 to 14. Keep your analysis out of the response.
\`[{"type": "gomoku_move", "name": "Your original name", "x": 7, "y": 7}, {"type": "text", "content": "Your in-character remark"}]\`
`;
}

export async function addGameEndSystemMessage(winner) {
            const chatId = runtime.state.activeChatId;
            const chat = runtime.state.chats[chatId];
            if (!chat) return;

            
            
            const userDisplayName = chat.isGroup ? (chat.settings.myNickname || '我') : '我';
            const aiDisplayName = chat.isGroup ? 'AI方' : chat.name;
            const winnerName = (winner === 'user') ? userDisplayName : aiDisplayName;
            const resultText = (winner === 'user') ? 'you lost' : 'you won';

            
            const systemContent = `[System notice: Gomoku ended. ${winnerName} won, so ${resultText}.]`;

            
            const hiddenMessage = {
                role: 'system',
                content: systemContent,
                timestamp: Date.now(),
                isHidden: true 
            };

            chat.history.push(hiddenMessage);
            await runtime.db.chats.put(chat);
            
            
            console.log(`游戏结束的系统提示已添加到历史记录中，等待AI下次查看。胜者: ${winner}`);
        }

export function bindGomokuEvents() {
  document.getElementById('gomoku-btn').addEventListener('click', toggleGomokuBoard);

document.getElementById('close-gomoku-btn').addEventListener('click', closeGomokuBoard);

controls.gomokuCanvas = document.getElementById('gomoku-board')

controls.gomokuCanvas.addEventListener('mousemove', handleBoardHover);

controls.gomokuCanvas.addEventListener('mouseout', () => renderGomokuBoard(runtime.state.activeChatId));

controls.gomokuCanvas.addEventListener('click', handleBoardClick);

document.getElementById('add-countdown-btn').addEventListener('click', () => {
            
            document.getElementById('countdown-title-input').value = '';
            document.getElementById('countdown-date-input').value = '';
            
            document.getElementById('create-countdown-modal').classList.add('visible');
        });
}
