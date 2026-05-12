import { createClient } from '@supabase/supabase-js';

const db = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

let todos = [];
let filter = 'all';
let currentUser = null;

// ── DOM ──────────────────────────────────────────────
const authSection       = document.getElementById('authSection');
const appSection        = document.getElementById('appSection');
const authForm          = document.getElementById('authForm');
const authEmail         = document.getElementById('authEmail');
const authPassword      = document.getElementById('authPassword');
const authSubmit        = document.getElementById('authSubmit');
const authToggle        = document.getElementById('authToggle');
const authError         = document.getElementById('authError');
const authSubtitle      = document.getElementById('authSubtitle');
const userEmailDisplay  = document.getElementById('userEmailDisplay');
const logoutBtn         = document.getElementById('logoutBtn');

const form          = document.getElementById('todoForm');
const input         = document.getElementById('todoInput');
const prioritySelect = document.getElementById('prioritySelect');
const list          = document.getElementById('todoList');
const footer        = document.getElementById('footer');
const remaining     = document.getElementById('remaining');
const clearDoneBtn  = document.getElementById('clearDone');
const todayEl       = document.getElementById('today');
const filterBtns    = document.querySelectorAll('.filter-btn');

// ── 날짜 표시 ─────────────────────────────────────────
todayEl.textContent = new Date().toLocaleDateString('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
});

// ── 에러 메시지 한글화 ────────────────────────────────
const ERROR_MAP = {
  'Invalid login credentials':              '이메일 또는 비밀번호가 올바르지 않습니다.',
  'Email not confirmed':                    '이메일 인증이 필요합니다. 받은편지함을 확인해주세요.',
  'User already registered':                '이미 등록된 이메일입니다.',
  'Password should be at least 6 characters': '비밀번호는 6자 이상이어야 합니다.',
  'Unable to validate email address':       '올바른 이메일 형식이 아닙니다.',
};

function translateError(msg) {
  for (const [en, ko] of Object.entries(ERROR_MAP)) {
    if (msg.includes(en)) return ko;
  }
  return msg;
}

// ── 화면 전환 ─────────────────────────────────────────
function showApp() {
  authSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  userEmailDisplay.textContent = currentUser.email;
}

function showAuth() {
  authSection.classList.remove('hidden');
  appSection.classList.add('hidden');
  todos = [];
  render();
}

// ── 인증 상태 감지 ────────────────────────────────────
db.auth.onAuthStateChange(async (event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    showApp();
    await loadTodos();
  } else {
    showAuth();
  }
});

// ── 인증 폼 ───────────────────────────────────────────
let isSignUp = false;

authToggle.addEventListener('click', () => {
  isSignUp = !isSignUp;
  authSubmit.textContent     = isSignUp ? '가입하기' : '로그인';
  authSubtitle.textContent   = isSignUp ? '새 계정을 만드세요' : '계정에 로그인하세요';
  authToggle.textContent     = isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 가입하기';
  setAuthError('');
});

authForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email    = authEmail.value.trim();
  const password = authPassword.value;

  setAuthError('');
  authSubmit.disabled    = true;
  authSubmit.textContent = '처리 중...';

  try {
    if (isSignUp) {
      const { error } = await db.auth.signUp({ email, password });
      if (error) throw error;
      setAuthError('가입 완료! 이제 로그인하세요.', 'success');
      isSignUp = false;
      authSubmit.textContent   = '로그인';
      authSubtitle.textContent = '계정에 로그인하세요';
      authToggle.textContent   = '계정이 없으신가요? 가입하기';
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    setAuthError(translateError(err.message));
    authSubmit.textContent = isSignUp ? '가입하기' : '로그인';
  } finally {
    authSubmit.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  const { error } = await db.auth.signOut();
  if (error) console.error('로그아웃 실패:', error);
});

function setAuthError(msg, type = 'error') {
  authError.textContent = msg;
  authError.className   = 'auth-error' + (type === 'success' ? ' success' : '');
}

// ── Todo CRUD ─────────────────────────────────────────
async function loadTodos() {
  list.innerHTML = '<li class="empty">불러오는 중...</li>';
  const { data, error } = await db
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });
  if (!error) {
    todos = data;
    render();
  }
}

async function addTodo(text, priority) {
  const { data, error } = await db
    .from('todos')
    .insert({ task: text, priority, is_complete: false, user_id: currentUser.id })
    .select()
    .single();
  if (error) {
    console.error('todo 추가 실패:', error);
    alert('저장 실패: ' + error.message);
    return;
  }
  todos.unshift(data);
  render();
}

async function toggle(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  const { error } = await db
    .from('todos')
    .update({ is_complete: !todo.is_complete })
    .eq('id', id);
  if (!error) {
    todo.is_complete = !todo.is_complete;
    render();
  }
}

async function remove(id) {
  const { error } = await db.from('todos').delete().eq('id', id);
  if (!error) {
    todos = todos.filter(t => t.id !== id);
    render();
  }
}

async function clearDone() {
  const doneIds = todos.filter(t => t.is_complete).map(t => t.id);
  if (doneIds.length === 0) return;
  const { error } = await db.from('todos').delete().in('id', doneIds);
  if (!error) {
    todos = todos.filter(t => !t.is_complete);
    render();
  }
}

// ── 렌더링 ────────────────────────────────────────────
function filtered() {
  let items = todos;
  if (filter === 'active') items = todos.filter(t => !t.is_complete);
  if (filter === 'done')   items = todos.filter(t => t.is_complete);

  const priorityMap = { high: 0, medium: 1, low: 2 };
  return [...items].sort(
    (a, b) => priorityMap[a.priority || 'medium'] - priorityMap[b.priority || 'medium']
  );
}

function render() {
  const items = filtered();
  list.innerHTML = '';

  if (items.length === 0) {
    list.innerHTML = '<li class="empty">항목이 없습니다</li>';
  } else {
    const priorityLabels = { high: '높음', medium: '보통', low: '낮음' };
    items.forEach(todo => {
      const li = document.createElement('li');
      li.className   = 'todo-item' + (todo.is_complete ? ' done' : '');
      li.dataset.id  = todo.id;

      const cb = document.createElement('input');
      cb.type    = 'checkbox';
      cb.checked = todo.is_complete;
      cb.addEventListener('change', () => toggle(todo.id));

      const badge = document.createElement('span');
      badge.className   = `priority-badge ${todo.priority || 'medium'}`;
      badge.textContent = priorityLabels[todo.priority || 'medium'];

      const span = document.createElement('span');
      span.className   = 'text';
      span.textContent = todo.task;

      const del = document.createElement('button');
      del.className = 'delete-btn';
      del.textContent = '×';
      del.setAttribute('aria-label', '삭제');
      del.addEventListener('click', () => remove(todo.id));

      li.append(cb, badge, span, del);
      list.appendChild(li);
    });
  }

  const activeCount = todos.filter(t => !t.is_complete).length;
  const doneCount   = todos.filter(t => t.is_complete).length;

  if (todos.length === 0) {
    footer.classList.add('hidden');
  } else {
    footer.classList.remove('hidden');
    remaining.textContent             = `${activeCount}개 남음`;
    clearDoneBtn.style.visibility     = doneCount > 0 ? 'visible' : 'hidden';
  }
}

// ── 이벤트 ────────────────────────────────────────────
form.addEventListener('submit', e => {
  e.preventDefault();
  const text     = input.value.trim();
  const priority = prioritySelect.value;
  if (text) {
    addTodo(text, priority);
    input.value          = '';
    prioritySelect.value = 'medium';
  }
});

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filter = btn.dataset.filter;
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
});

clearDoneBtn.addEventListener('click', clearDone);
