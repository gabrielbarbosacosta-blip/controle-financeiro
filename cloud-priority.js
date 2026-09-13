(function(){
  const prefix='controleFinanceiroWebV2UpdatedAt:user:';
  const original=Storage.prototype.getItem;
  Storage.prototype.getItem=function(key){
    if(this===localStorage&&String(key||'').startsWith(prefix))return '1970-01-01T00:00:00.000Z';
    return original.call(this,key);
  };
})();
