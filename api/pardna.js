<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="background:#111;color:#fff;font-family:monospace;padding:20px">
<div id="out">Testing...</div>
<script>
fetch('/api/pardna',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'load'})})
.then(r=>r.json())
.then(d=>document.getElementById('out').innerText=JSON.stringify(d).slice(0,500))
.catch(e=>document.getElementById('out').innerText='ERROR: '+e);
</script>
</body>
</html>
