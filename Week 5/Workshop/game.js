(() => {
  "use strict";

  const boardElement = document.getElementById("board");
  const statusMessage = document.getElementById("statusMessage");
  const statusDetail = document.getElementById("statusDetail");
  const turnPill = document.getElementById("turnPill");
  const statusIcon = document.getElementById("statusIcon");
  const moveCountElement = document.getElementById("moveCount");
  const moveLog = document.getElementById("moveLog");
  const capturedByWhite = document.getElementById("capturedByWhite");
  const capturedByBlack = document.getElementById("capturedByBlack");
  const whiteCapturedCount = document.getElementById("whiteCaptured");
  const blackCapturedCount = document.getElementById("blackCaptured");
  const turnNumberElement = document.getElementById("turnNumber");
  const levelBadge = document.getElementById("levelBadge");
  const levelLabel = document.getElementById("botLevelLabel");
  const levelDescription = document.getElementById("levelDescription");
  const announcement = document.getElementById("announcement");
  const helpDialog = document.getElementById("helpDialog");
  const themeButton = document.getElementById("themeButton");

  const GLYPHS = {
    wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
    bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟"
  };
  const NAMES = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
  const VALUES = { k: 10000, q: 900, r: 500, b: 330, n: 320, p: 100 };
  const LEVEL_TEXT = {
    1: "The bot favors captures and occasionally makes imperfect choices.",
    2: "The bot weighs captures, piece safety, and simple positional gains.",
    3: "The bot looks one reply ahead and strongly prefers safe, valuable captures."
  };

  let board = [];
  let turn = "w";
  let selected = null;
  let legalTargets = [];
  let captured = { w: [], b: [] };
  let history = [];
  let gameOver = false;
  let level = 1;
  let lastMove = null;
  let botThinking = false;
  let draggedFrom = null;
  let focusedSquare = { row: 7, col: 4 };
  let moveNumber = 1;
  let pendingTimers = [];

  const piece = (type, color) => ({ type, color });
  const squareName = (row, col) => `${"abcdefgh"[col]}${8 - row}`;
  const parseSquare = (name) => ({ row: 8 - Number(name[1]), col: name.charCodeAt(0) - 97 });
  const inBounds = (row, col) => row >= 0 && row < 8 && col >= 0 && col < 8;
  const otherColor = (color) => color === "w" ? "b" : "w";
  const pieceCode = (p) => p ? `${p.color}${p.type}` : "";
  const cancelTimers = () => { pendingTimers.forEach(clearTimeout); pendingTimers = []; };
  const later = (fn, ms) => { const id = setTimeout(fn, ms); pendingTimers.push(id); return id; };

  function startingBoard() {
    const next = Array.from({ length: 8 }, () => Array(8).fill(null));
    const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
    for (let col = 0; col < 8; col += 1) {
      next[0][col] = piece(back[col], "b");
      next[1][col] = piece("p", "b");
      next[6][col] = piece("p", "w");
      next[7][col] = piece(back[col], "w");
    }
    return next;
  }

  function pieceAt(pos) {
    return inBounds(pos.row, pos.col) ? board[pos.row][pos.col] : null;
  }

  function pseudoMovesFrom(from) {
    const p = pieceAt(from);
    if (!p) return [];
    const moves = [];
    const add = (row, col, captureOnly = false) => {
      if (!inBounds(row, col)) return false;
      const target = board[row][col];
      if (target && target.color === p.color) return false;
      if (captureOnly && !target) return true;
      moves.push({ from: { ...from }, to: { row, col }, capture: target ? { ...target } : null });
      return !target;
    };
    const step = p.color === "w" ? -1 : 1;

    if (p.type === "p") {
      const nextRow = from.row + step;
      if (inBounds(nextRow, from.col) && !board[nextRow][from.col]) {
        add(nextRow, from.col);
        const startRow = p.color === "w" ? 6 : 1;
        const twoRow = from.row + step * 2;
        if (from.row === startRow && !board[twoRow][from.col]) add(twoRow, from.col);
      }
      for (const dc of [-1, 1]) {
        const row = from.row + step, col = from.col + dc;
        if (inBounds(row, col) && board[row][col] && board[row][col].color !== p.color) add(row, col);
      }
    } else if (p.type === "n") {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(from.row + dr, from.col + dc);
    } else if (p.type === "k") {
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
        if (dr !== 0 || dc !== 0) add(from.row + dr, from.col + dc);
      }
    } else {
      const directions = [];
      if (p.type === "r" || p.type === "q") directions.push([-1,0],[1,0],[0,-1],[0,1]);
      if (p.type === "b" || p.type === "q") directions.push([-1,-1],[-1,1],[1,-1],[1,1]);
      for (const [dr, dc] of directions) {
        let row = from.row + dr, col = from.col + dc;
        while (inBounds(row, col)) {
          const canContinue = add(row, col);
          if (!canContinue) break;
          row += dr; col += dc;
        }
      }
    }
    return moves;
  }

  function allMoves(color) {
    const moves = [];
    for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) {
      const p = board[row][col];
      if (p && p.color === color) moves.push(...pseudoMovesFrom({ row, col }));
    }
    return moves;
  }

  function isSquareAttacked(pos, byColor) {
    for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) {
      const p = board[row][col];
      if (!p || p.color !== byColor) continue;
      if (p.type === "p") {
        const step = p.color === "w" ? -1 : 1;
        if (row + step === pos.row && Math.abs(col - pos.col) === 1) return true;
      } else if (pseudoMovesFrom({ row, col }).some(m => m.to.row === pos.row && m.to.col === pos.col)) {
        return true;
      }
    }
    return false;
  }

  function findKing(color) {
    for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) {
      const p = board[row][col];
      if (p && p.color === color && p.type === "k") return { row, col };
    }
    return null;
  }

  function isKingCapture(move) {
    const target = pieceAt(move.to);
    return target && target.type === "k";
  }

  function renderBoard(animate = null) {
    boardElement.replaceChildren();
    for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) {
      const pos = { row, col };
      const p = board[row][col];
      const button = document.createElement("button");
      button.type = "button";
      button.className = `square ${(row + col) % 2 === 0 ? "square-light" : "square-cyan"}`;
      button.dataset.row = String(row);
      button.dataset.col = String(col);
      button.dataset.square = squareName(row, col);
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", `${squareName(row, col)}${p ? `, ${p.color === "w" ? "white" : "black"} ${NAMES[p.type]}` : ", empty"}${isSelected(pos) ? ", selected" : ""}${isTarget(pos) ? ", legal destination" : ""}`);
      button.setAttribute("aria-selected", String(isSelected(pos)));
      if (isSelected(pos)) button.classList.add("selected");
      if (lastMove && (samePos(pos, lastMove.from) || samePos(pos, lastMove.to))) button.classList.add("last-move");
      if (isTarget(pos)) button.classList.add(pieceAt(pos) ? "legal-capture" : "legal-target");
      if (animate && samePos(pos, animate.to)) button.classList.add("just-moved");
      if (animate && animate.capturePos && samePos(pos, animate.capturePos)) button.classList.add("captured-flash");

      if (p) {
        const span = document.createElement("span");
        span.className = `piece ${p.color === "w" ? "white-piece" : "black-piece"}`;
        span.textContent = GLYPHS[pieceCode(p)];
        span.draggable = !gameOver && !botThinking && turn === "w" && p.color === "w";
        span.setAttribute("aria-hidden", "true");
        span.addEventListener("dragstart", (event) => {
          if (gameOver || botThinking || turn !== "w" || p.color !== "w") { event.preventDefault(); return; }
          draggedFrom = pos;
          event.dataTransfer?.setData("text/plain", squareName(row, col));
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          selectSquare(pos);
        });
        span.addEventListener("dragend", () => { draggedFrom = null; boardElement.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over")); });
        button.append(span);
      }
      if (col === 0) {
        const coord = document.createElement("span");
        coord.className = "coordinate";
        coord.textContent = String(8 - row);
        button.append(coord);
      } else if (row === 7) {
        const coord = document.createElement("span");
        coord.className = "coordinate";
        coord.textContent = "abcdefgh"[col];
        button.append(coord);
      }
      button.addEventListener("click", () => handleSquareClick(pos));
      button.addEventListener("dragover", (event) => {
        if (draggedFrom) { event.preventDefault(); button.classList.add("drag-over"); }
      });
      button.addEventListener("dragleave", () => button.classList.remove("drag-over"));
      button.addEventListener("drop", (event) => {
        event.preventDefault();
        button.classList.remove("drag-over");
        if (!draggedFrom) return;
        const from = draggedFrom;
        draggedFrom = null;
        attemptMove(from, pos);
      });
      button.addEventListener("keydown", handleSquareKeydown);
      boardElement.append(button);
    }
  }

  function samePos(a, b) { return !!a && !!b && a.row === b.row && a.col === b.col; }
  function isSelected(pos) { return samePos(pos, selected); }
  function isTarget(pos) { return legalTargets.some(m => samePos(m.to, pos)); }

  function selectSquare(pos) {
    const p = pieceAt(pos);
    if (!p || p.color !== "w" || turn !== "w" || gameOver || botThinking) {
      selected = null; legalTargets = []; renderBoard(); return;
    }
    selected = pos;
    legalTargets = pseudoMovesFrom(pos);
    focusedSquare = pos;
    renderBoard();
    const targetButton = boardElement.querySelector(`[data-square="${squareName(pos.row, pos.col)}"]`);
    targetButton?.focus({ preventScroll: true });
    announce(`${NAMES[p.type]} selected at ${squareName(pos.row, pos.col)}. ${legalTargets.length} possible moves.`);
  }

  function handleSquareClick(pos) {
    if (gameOver || botThinking || turn !== "w") return;
    const p = pieceAt(pos);
    if (selected && isTarget(pos)) { attemptMove(selected, pos); return; }
    if (p && p.color === "w") { selectSquare(pos); return; }
    selected = null; legalTargets = []; renderBoard();
  }

  function handleSquareKeydown(event) {
    const row = Number(event.currentTarget.dataset.row);
    const col = Number(event.currentTarget.dataset.col);
    let next = { row, col };
    if (event.key === "ArrowUp") next.row -= 1;
    else if (event.key === "ArrowDown") next.row += 1;
    else if (event.key === "ArrowLeft") next.col -= 1;
    else if (event.key === "ArrowRight") next.col += 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); handleSquareClick({ row, col }); return;
    } else return;
    event.preventDefault();
    next.row = Math.max(0, Math.min(7, next.row));
    next.col = Math.max(0, Math.min(7, next.col));
    focusedSquare = next;
    boardElement.querySelector(`[data-square="${squareName(next.row, next.col)}"]`)?.focus();
  }

  function attemptMove(from, to) {
    if (gameOver || botThinking || turn !== "w") return;
    const move = pseudoMovesFrom(from).find(m => samePos(m.to, to));
    if (!move) {
      const target = pieceAt(to);
      if (target && target.color === "w") selectSquare(to);
      else announce("That move is not legal. Choose a highlighted square.");
      return;
    }
    playMove(move, false);
  }

  function playMove(move, byBot) {
    const moving = pieceAt(move.from);
    if (!moving) return;
    const target = pieceAt(move.to);
    const capturedPiece = target ? { ...target } : null;
    const capturedPosition = capturedPiece ? { ...move.to } : null;
    const fromName = squareName(move.from.row, move.from.col);
    const toName = squareName(move.to.row, move.to.col);
    board[move.to.row][move.to.col] = { ...moving };
    board[move.from.row][move.from.col] = null;

    // Automatic queen promotion keeps the game moving without a modal interruption.
    if (moving.type === "p" && (move.to.row === 0 || move.to.row === 7)) {
      board[move.to.row][move.to.col].type = "q";
    }

    if (capturedPiece) captured[ moving.color ].push(capturedPiece);
    lastMove = { from: move.from, to: move.to };
    history.unshift({
      color: moving.color,
      piece: moving.type,
      from: fromName,
      to: toName,
      captured: capturedPiece,
      promotion: moving.type === "p" && (move.to.row === 0 || move.to.row === 7)
    });
    if (moving.color === "b") moveNumber += 1;
    turn = otherColor(moving.color);
    selected = null; legalTargets = [];
    updatePanels();

    if (capturedPiece && capturedPiece.type === "k") {
      gameOver = true;
      botThinking = false;
      renderBoard({ to: move.to, capturePos: capturedPosition });
      setTimeout(() => {
        if (moving.color === "w") {
          setStatus("VICTORY — KING CAPTURED!", `You captured the black king on ${toName}. Start a new game to hunt again.`, "win");
          burstConfetti();
        } else {
          setStatus("DEFEAT — YOUR KING FELL", `The bot captured your king on ${toName}. Change the level and try again.`, "loss");
        }
        renderBoard();
      }, reducedMotion() ? 0 : 420);
      announce(`${moving.color === "w" ? "You win" : "You lose"}. The king was captured.`);
      return;
    }

    renderBoard({ to: move.to, capturePos: capturedPosition });
    if (capturedPiece) {
      announce(`${moving.color === "w" ? "You captured" : "Bot captured"} ${capturedPiece.color === "w" ? "white" : "black"} ${NAMES[capturedPiece.type]} at ${toName}.`);
      setStatus(byBot ? "Bot captured a piece" : "Piece captured!", `${moving.color === "w" ? "White" : "Black"} moved ${fromName} to ${toName}. The captured piece is removed.`, "capture");
    } else {
      setStatus(byBot ? "Bot moved" : "Move complete", `${moving.color === "w" ? "White" : "Black"} moved ${fromName} to ${toName}.`, "normal");
    }
    if (!byBot) {
      botThinking = true;
      turnPill.textContent = "Bot thinking…";
      setStatus("Bot is thinking…", "The black pieces are choosing a move.", "thinking");
      renderBoard();
      later(makeBotMove, reducedMotion() ? 80 : 460);
    } else {
      botThinking = false;
      turnPill.textContent = "Your turn";
      renderBoard();
    }
  }

  function materialScore(color) {
    let score = 0;
    for (const row of board) for (const p of row) if (p && p.color === color) score += VALUES[p.type];
    return score;
  }

  function moveScore(move, color) {
    const moving = pieceAt(move.from);
    const target = pieceAt(move.to);
    let score = 0;
    if (target) score += VALUES[target.type] * 1.2 - VALUES[moving.type] * 0.08;
    if (target && target.type === "k") score += 100000;
    if (moving.type === "p" && (move.to.row === 0 || move.to.row === 7)) score += 850;
    // Favor active central squares and slight development.
    score += (3.5 - Math.abs(3.5 - move.to.col) + 3.5 - Math.abs(3.5 - move.to.row)) * (level >= 2 ? 1.5 : 0.35);
    const oldPiece = board[move.to.row][move.to.col];
    board[move.to.row][move.to.col] = { ...moving };
    board[move.from.row][move.from.col] = null;
    const kingPos = findKing(color);
    if (kingPos && isSquareAttacked(kingPos, otherColor(color))) score -= level >= 2 ? VALUES[moving.type] * 0.75 : VALUES[moving.type] * 0.18;
    board[move.from.row][move.from.col] = moving;
    board[move.to.row][move.to.col] = oldPiece;
    return score;
  }

  function chooseBotMove() {
    const moves = allMoves("b");
    if (!moves.length) return null;
    const scored = moves.map(move => ({ move, score: moveScore(move, "b") }));
    scored.sort((a, b) => b.score - a.score);
    if (level === 1) {
      const top = scored.slice(0, Math.min(8, scored.length));
      return top[Math.floor(Math.random() * top.length)].move;
    }
    if (level === 2) {
      const top = scored.slice(0, Math.min(4, scored.length));
      return top[Math.floor(Math.random() * top.length)].move;
    }
    // Level 3: one-ply lookahead after each candidate. King safety is only a heuristic;
    // moves are never rejected for leaving a king attacked, by design.
    let bestMove = scored[0].move, bestScore = -Infinity;
    for (const candidate of scored.slice(0, 12)) {
      const m = candidate.move;
      const moving = pieceAt(m.from), taken = pieceAt(m.to);
      board[m.to.row][m.to.col] = { ...moving };
      board[m.from.row][m.from.col] = null;
      if (moving.type === "p" && (m.to.row === 0 || m.to.row === 7)) board[m.to.row][m.to.col].type = "q";
      const replies = allMoves("w");
      let replyThreat = 0;
      for (const reply of replies) {
        const victim = pieceAt(reply.to);
        if (victim) {
          const value = victim.type === "k" ? 50000 : VALUES[victim.type];
          if (reply.to.row === m.to.row && reply.to.col === m.to.col) replyThreat = Math.max(replyThreat, value);
        }
      }
      const score = candidate.score - replyThreat * 0.8;
      board[m.from.row][m.from.col] = moving;
      board[m.to.row][m.to.col] = taken;
      if (score > bestScore) { bestScore = score; bestMove = m; }
    }
    return bestMove;
  }

  function makeBotMove() {
    if (gameOver || turn !== "b") { botThinking = false; return; }
    const move = chooseBotMove();
    if (!move) {
      gameOver = true;
      botThinking = false;
      setStatus("DRAW — NO MOVES", "Neither side can continue. Start a new game.", "draw");
      return;
    }
    playMove(move, true);
  }

  function updatePanels() {
    const whiteTook = captured.w;
    const blackTook = captured.b;
    whiteCapturedCount.textContent = String(whiteTook.length);
    blackCapturedCount.textContent = String(blackTook.length);
    turnNumberElement.textContent = String(moveNumber);
    moveCountElement.textContent = `Move ${moveNumber}`;
    renderCaptured(capturedByWhite, whiteTook);
    renderCaptured(capturedByBlack, blackTook);
    moveLog.replaceChildren();
    if (!history.length) {
      const empty = document.createElement("li");
      empty.className = "text-sm text-slate-400";
      empty.textContent = "Your first move will appear here.";
      moveLog.append(empty);
    } else {
      history.slice(0, 24).forEach((entry, index) => {
        const li = document.createElement("li");
        const idx = document.createElement("span");
        idx.className = "move-index";
        idx.textContent = `${history.length - index}.`;
        const text = document.createElement("span");
        const color = entry.color === "w" ? "You" : "Bot";
        const captureText = entry.captured ? ` × ${NAMES[entry.captured.type]}` : "";
        text.textContent = `${color}: ${NAMES[entry.piece]} ${entry.from} → ${entry.to}${captureText}${entry.promotion ? " = queen" : ""}`;
        li.append(idx, text);
        moveLog.append(li);
      });
    }
  }

  function renderCaptured(container, pieces) {
    container.replaceChildren();
    if (!pieces.length) { container.textContent = "—"; return; }
    pieces.forEach(p => {
      const span = document.createElement("span");
      span.className = `captured-piece ${p.color === "w" ? "captured-white" : "captured-black"}`;
      span.textContent = GLYPHS[pieceCode(p)];
      span.title = `${p.color === "w" ? "White" : "Black"} ${NAMES[p.type]}`;
      span.setAttribute("aria-label", span.title);
      container.append(span);
    });
  }

  function setStatus(title, detail, kind) {
    statusMessage.textContent = title;
    statusDetail.textContent = detail;
    statusIcon.textContent = kind === "win" ? "★" : kind === "loss" ? "×" : kind === "capture" ? "✦" : kind === "thinking" ? "…" : "●";
    statusIcon.style.color = kind === "win" ? "#16a34a" : kind === "loss" ? "#e11d48" : kind === "capture" ? "#d97706" : "#06b6d4";
    turnPill.textContent = gameOver ? (kind === "win" ? "Victory" : kind === "loss" ? "Defeat" : "Game over") : turn === "w" ? "Your turn" : "Bot turn";
  }

  function announce(message) { announcement.textContent = message; }

  function resetGame() {
    cancelTimers();
    board = startingBoard();
    turn = "w"; selected = null; legalTargets = []; captured = { w: [], b: [] };
    history = []; gameOver = false; botThinking = false; lastMove = null; draggedFrom = null;
    moveNumber = 1;
    setStatus("Your turn. Select a white piece.", "Capture the black king to win. Your king can be captured too.", "normal");
    updatePanels();
    renderBoard();
    announce("New game started. Your turn.");
  }

  function burstConfetti() {
    if (reducedMotion()) return;
    const colors = ["#06b6d4", "#f59e0b", "#f472b6", "#22c55e", "#818cf8"];
    for (let i = 0; i < 34; i += 1) {
      const bit = document.createElement("span");
      bit.className = "confetti-bit";
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.backgroundColor = colors[i % colors.length];
      bit.style.setProperty("--drift", `${Math.random() * 150 - 75}px`);
      bit.style.animationDelay = `${Math.random() * 220}ms`;
      document.body.append(bit);
      setTimeout(() => bit.remove(), 1500);
    }
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  document.getElementById("restartButton").addEventListener("click", resetGame);
  document.getElementById("helpButton").addEventListener("click", () => helpDialog.showModal());
  document.getElementById("closeHelp").addEventListener("click", () => helpDialog.close());
  document.getElementById("gotItButton").addEventListener("click", () => helpDialog.close());
  helpDialog.addEventListener("click", (event) => {
    if (event.target === helpDialog) helpDialog.close();
  });

  document.querySelectorAll("[data-level]").forEach(button => {
    button.addEventListener("click", () => {
      level = Number(button.dataset.level);
      document.querySelectorAll("[data-level]").forEach(other => {
        const active = other === button;
        other.classList.toggle("is-selected", active);
        other.setAttribute("aria-pressed", String(active));
      });
      levelBadge.textContent = `LV ${level}`;
      levelLabel.textContent = `Level ${level}`;
      levelDescription.textContent = LEVEL_TEXT[level];
      if (!gameOver) announce(`Bot difficulty set to level ${level}.`);
    });
  });

  themeButton.addEventListener("click", () => {
    const dark = document.body.classList.toggle("dark-mode");
    themeButton.textContent = dark ? "Light mode" : "Dark mode";
    themeButton.setAttribute("aria-pressed", String(dark));
  });

  // Keyboard shortcuts: N starts a new game; Escape clears current selection.
  document.addEventListener("keydown", (event) => {
    if (event.key === "n" || event.key === "N") {
      if (!["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) && !helpDialog.open) resetGame();
    }
    if (event.key === "Escape" && !helpDialog.open && selected) {
      selected = null; legalTargets = []; renderBoard(); announce("Selection cleared.");
    }
  });

  // Add animation keyframes as a small independent effect layer.
  const animationStyle = document.createElement("style");
  animationStyle.textContent = `
    .confetti-bit { position: fixed; top: -12px; width: 8px; height: 13px; z-index: 100; pointer-events: none; animation: confetti-fall 1.25s cubic-bezier(.2,.7,.4,1) forwards; }
    @keyframes confetti-fall { to { transform: translate3d(var(--drift), 105vh, 0) rotate(720deg); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .confetti-bit { display: none !important; animation: none !important; } }
    @media (forced-colors: active) { .confetti-bit { display: none; } }
  `;
  document.head.append(animationStyle);

  resetGame();
})();
