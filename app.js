// هذا الملف يحتوي على الجافاسكريبت الخاص بالتطبيق

document.addEventListener('DOMContentLoaded', init);

function init() {
  console.log('App initialized');
  
  // تسجيل Service Worker إذا كان المدعوم
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch(error => {
          console.log('ServiceWorker registration failed: ', error);
        });
    });
  }
  
  // إضافة مستمعين للأزرار
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.addEventListener('click', handleButtonClick);
  });
  
  // إضافة تأثيرات للعناصر
  animateElements();
  
  // التحقق من حالة الاتصال بالإنترنت
  checkNetworkStatus();
}

function handleButtonClick(e) {
  const buttonText = e.target.textContent;
  console.log(`Button clicked: ${buttonText}`);
  
  // عرض رسالة للمستخدم
  showNotification(`تم النقر على: ${buttonText}`);
}

function animateElements() {
  const features = document.querySelectorAll('.feature');
  
  features.forEach((feature, index) => {
    // تأخير ظهور العناصر تدريجياً
    feature.style.opacity = 0;
    feature.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      feature.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      feature.style.opacity = 1;
      feature.style.transform = 'translateY(0)';
    }, 100 * index);
  });
}

function showNotification(message) {
  // إنشاء عنصر للإشعار
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.backgroundColor = '#333';
  notification.style.color = '#fff';
  notification.style.padding = '10px 20px';
  notification.style.borderRadius = '5px';
  notification.style.zIndex = '1000';
  notification.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.2)';
  
  document.body.appendChild(notification);
  
  // إزالة الإشعار بعد 3 ثوان
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}

function checkNetworkStatus() {
  // التحقق من حالة الاتصال
  if (!navigator.onLine) {
    showNotification('أنت غير متصل بالإنترنت حالياً');
  }
  
  // الاستماع لتغيرات حالة الاتصال
  window.addEventListener('online', () => {
    showNotification('تم استعادة الاتصال بالإنترنت');
  });
  
  window.addEventListener('offline', () => {
    showNotification('فقدت الاتصال بالإنترنت');
  });
}

// دالة لإضافة أيقونات للعناصر (سيتم استدعاؤها من HTML)
function addIcons() {
  const features = document.querySelectorAll('.feature');
  
  // إضافة أيقونات مختلفة لكل عنصر
  const icons = ['🚀', '📱', '💾', '🔔'];
  
  features.forEach((feature, index) => {
    const iconElement = document.createElement('div');
    iconElement.textContent = icons[index] || '⭐';
    iconElement.style.fontSize = '2.5rem';
    iconElement.style.marginBottom = '15px';
    
    feature.insertBefore(iconElement, feature.firstChild);
  });
}
