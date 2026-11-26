# CHANGELOG_FIXES.md

Catatan perbaikan bug dan perubahan yang sudah terverifikasi.

<!-- ENTRI BARU DI BAWAH BARIS INI -->

### Fix #1 — Update spesifikasi dan dokumentasi untuk Auth UI, halaman baru, dan board sharing out of scope
**Tanggal**: 2026-12-03 13:56 WIB  
**File**: 
- `specs/design.md`
- `specs/requirements.md`
- `.kiro/steering/design_ui.md`
- `README.md`

**Masalah**: 
- Spesifikasi tidak mencerminkan struktur route group `(auth)` dan layout baru.
- Halaman baru (Inbox, Notes, Reports) tidak didokumentasikan.
- Board sharing/members tidak secara eksplisit dinyatakan out of scope di semua dokumentasi.

**Akar**: 
- Dokumentasi awal ditulis sebelum route group dan halaman baru diimplementasikan.
- Tidak ada mekanisme untuk menyinkronkan perubahan kode dengan spesifikasi.

**Fix**: 
1. **F1 — `specs/design.md`**: 
   - Update section 6.2 (Pages) untuk mencerminkan route `(auth)` dan halaman baru (`/inbox`, `/notes`, `/reports`).
   - Update section 1 (Key decisions) untuk menjelaskan bahwa auth pages menggunakan route group `(auth)`.

2. **F2 — `specs/requirements.md`**: 
   - Tambahkan catatan di section 8 (Out of scope) bahwa board sharing/members/roles secara eksplisit out of scope.
   - Rujukan ke section 2 dan design.md section 1 sebagai konfirmasi.

3. **F3 — `docs/adr/README.md`**: 
   - Tidak ada ADR yang perlu diupdate (hanya berisi template ADR).

4. **F4 — `.kiro/steering/design_ui.md`**: 
   - Tambahkan section 8 (Auth Pages) dengan detail layout dua kolom (brand panel + form card).
   - Tambahkan section 9 (Inbox, Notes & Reports Pages) dengan tujuan dan layout masing-masing.
   - Update section 10 (Implementation Notes) untuk menyebutkan auth pages menggunakan layout `(auth)`.
   - Update section 11 (Acceptance Checklist) dengan item untuk auth pages, inbox, notes, dan reports.

5. **F5 — `README.md`**: 
   - Update section 1 (Core Features) dengan fitur Auth Pages, Inbox, Notes, Reports.
   - Update section 3 (Features Implemented) dengan baris untuk Auth pages, Inbox, Notes, Reports.
   - Update section 7 (Screenshots) dengan halaman `/inbox`, `/notes`, `/reports`.
   - Tambahkan catatan di section 1 (User Roles) bahwa board sharing out of scope.

**Verifikasi**: 
- ✅ `grep -n "board sharing\|members and roles" specs/requirements.md` → 3 hasil (section 2, 8, dan catatan baru).
- ✅ `grep -n "(auth)\|AuthBackground\|/inbox\|/notes\|/reports" .kiro/steering/design_ui.md` → 6 hasil (section 8, 9, 10).
- ✅ `grep -n "/login\|/register\|/inbox\|/notes\|/reports" specs/design.md` → 15+ hasil (section 6.2 dan traceability).
- ✅ `grep -n "Inbox\|Notes\|Reports\|Auth pages" README.md` → 10+ hasil (section 1, 3, 7).

**Pelajaran**: 
- Dokumentasi harus diupdate setiap kali ada perubahan struktur (route group, halaman baru, fitur out of scope).
- Gunakan grep untuk memverifikasi bahwa semua rujukan sudah konsisten.
- Jangan biarkan spesifikasi menjadi "basi" — sinkronkan dengan kode secara berkala.

**Log Keyword**: `auth-ui`, `inbox-notes-reports`, `board-sharing-out-of-scope`
