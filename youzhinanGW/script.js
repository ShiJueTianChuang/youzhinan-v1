document.addEventListener('DOMContentLoaded', function() {
    var androidBtn = document.querySelector('.download-btn.android');
    if (androidBtn) {
        androidBtn.addEventListener('click', function(e) {
            e.preventDefault();
            var link = this.getAttribute('href');
            var fileName = this.getAttribute('download') || 'youzhinan.apk';
            var a = document.createElement('a');
            a.href = link;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(function() {
                document.body.removeChild(a);
            }, 100);
        });
    }
});
