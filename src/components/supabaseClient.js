// supabaseClient.js
import { createClient } from '@supabase/supabase-js'

// 請將下方字串替換為您從 Supabase 專案設定中取得的網址與 Anon 金鑰
const SUPABASE_URL = 'https://cubjbxmynakarzvefoxs.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YmpieG15bmFrYXJ6dmVmb3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDAxODgsImV4cCI6MjEwODM3NjE4OH0.QYwJFFRTFM1uTObGay4SuHk4ctJt_XAiL0lj-zkP3tU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)