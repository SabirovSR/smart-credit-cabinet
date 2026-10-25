window.addEventListener('load', function () {
  window.SwaggerUIBundle({url:'/api/v1/openapi',dom_id:'#swagger-ui',deepLinking:true,validatorUrl:null,withCredentials:true,
    requestInterceptor: function(request) {if(request.method !== 'GET')request.headers.Origin=window.location.origin;return request;}
  });
});
