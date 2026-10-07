// Báo cáo kiểm thử: mỗi tệp *.test.mjs ghi các "check" (tên, đạt / không, chi tiết), in từng dòng, và cuối cùng một dòng
// `@@RESULT {json}` cho trình chạy (run.mjs) gom lại. Mã thoát 1 nếu có check không đạt hoặc lỗi trang.
export function createReport(name) {
  const checks = [];
  let section = '';
  const r = {
    /** Nhóm các check theo phần (in ra làm tiêu đề). */
    section(title) {
      section = title;
      console.log(`\n## ${title}`);
    },
    /** @param {string} id @param {boolean} ok @param {any} [detail] */
    check(id, ok, detail) {
      const full = section ? `${section} › ${id}` : id;
      checks.push({ id: full, ok: !!ok, detail: detail === undefined ? undefined : detail });
      const d = detail === undefined ? '' : ` ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`.slice(0, 400);
      console.log(`${ok ? '  ✓' : '  ✗'} ${id}${ok ? '' : d}`);
      return !!ok;
    },
    /** Ghi thông tin (không phải check) — chỉ in. */
    info(label, data) {
      console.log(`  · ${label} ${typeof data === 'string' ? data : JSON.stringify(data)}`.slice(0, 600));
    },
    /** Kết thúc: in dòng @@RESULT; trả mã thoát. pageErrors: lỗi JS của trang (mỗi lỗi là một check không đạt). */
    finish(pageErrors = []) {
      for (const e of pageErrors) checks.push({ id: `page error: ${e}`, ok: false });
      if (pageErrors.length) console.log(`  ✗ ${pageErrors.length} page error(s): ${pageErrors.join(' | ').slice(0, 400)}`);
      const fail = checks.filter((c) => !c.ok);
      console.log(`@@RESULT ${JSON.stringify({ name, pass: checks.length - fail.length, fail: fail.length, failed: fail.map((c) => c.id) })}`);
      return fail.length ? 1 : 0;
    },
  };
  return r;
}
