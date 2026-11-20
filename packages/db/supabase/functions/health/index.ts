// בדיקת תקינות: רק האם ההגדרות קיימות. לא מחזיר שום ערך סודי.
Deno.serve(() => {
  const k = Deno.env.get('DATA_KEY') ?? '';
  const body = {
    dataKeySet: k.length > 0,
    dataKeyLongEnough: k.length >= 32,
    supabaseEnv: !!Deno.env.get('SUPABASE_URL') && !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  };
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
});
