-- ============================================================
-- Supabase 대시보드 > SQL Editor 에서 아래 SQL을 실행하세요
-- ============================================================

-- todos 테이블 생성
create table todos (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references auth.users not null,
  text       text        not null,
  done       boolean     default false,
  priority   text        default 'medium' check (priority in ('high', 'medium', 'low')),
  created_at timestamptz default now()
);

-- Row Level Security 활성화 (다른 사용자의 데이터 접근 차단)
alter table todos enable row level security;

-- 자신의 todos만 조회/생성/수정/삭제 가능
create policy "본인 todos만 접근 가능" on todos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 이메일 인증 없이 바로 로그인하려면:
-- Supabase 대시보드 > Authentication > Providers > Email
-- "Confirm email" 토글을 OFF 로 설정
-- ============================================================
