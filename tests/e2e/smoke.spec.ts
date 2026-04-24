import { test, expect } from '@playwright/test';

/**
 * Smoke tests — verifica que el sitio carga y los elementos clave están presentes.
 * Corren contra producción (www.chass1s.com) sin credenciales.
 */
test.describe('Smoke — página principal', () => {
  test('carga la página correctamente', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CHASS1S/i);
  });

  test('muestra el logo y el header', async ({ page }) => {
    await page.goto('/');
    // Header visible
    await expect(page.locator('text=BO11Y FRAMEWORK')).toBeVisible();
  });

  test('muestra el formulario de generación', async ({ page }) => {
    await page.goto('/');
    // Textarea de input del negocio
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('muestra los tiers de selección', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /COMPACT/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /EXECUTIVE/i }).first()).toBeVisible();
  });

  test('footer muestra el copyright correcto', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=88 GREENWICH AVE LLC')).toBeVisible();
  });

  test('healthcheck responde 200 con stack OK', async ({ request }) => {
    const res = await request.get('/api/healthcheck');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ANTHROPIC_API_KEY).toBe(true);
    expect(body.VITE_SUPABASE_URL).toBe(true);
    expect(body.SUPABASE_APIKEY_VALID).toBe(true);
  });
});

// Helper: abre el auth modal desde el GuestMenu (ícono → dropdown → SIGN IN)
async function openAuthModal(page: import('@playwright/test').Page) {
  // 1. Click el ícono de guest (top-right) para abrir el dropdown
  await page.locator('button').filter({ has: page.locator('svg, [style*="border-radius: 50"]') }).last().click();
  // 2. Click SIGN IN dentro del dropdown
  await page.getByText('SIGN IN').first().click();
  // 3. Esperar el email input
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
}

test.describe('Smoke — autenticación', () => {
  test('GuestMenu → SIGN IN abre el modal de auth', async ({ page }) => {
    await page.goto('/');
    await openAuthModal(page);
  });

  test('modal de auth se cierra con Escape', async ({ page }) => {
    await page.goto('/');
    await openAuthModal(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('input[type="email"]')).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Smoke — generación (guest bloqueado)', () => {
  test('intento de generar sin login muestra auth modal', async ({ page }) => {
    await page.goto('/');
    // Llena el textarea
    await page.locator('textarea').fill('Una cafetería en Buenos Aires que vende café de especialidad');
    // Click en el botón de generar
    const generateBtn = page.locator('button', { hasText: /fabricat|generat|start|iniciar/i }).first();
    await generateBtn.click();
    // Debe pedir login
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 3000 });
  });
});
