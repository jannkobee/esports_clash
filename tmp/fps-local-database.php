<?php
require __DIR__.'/../EsportsClash.Api/vendor/autoload.php';
$app=require __DIR__.'/../EsportsClash.Api/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$connection=config('database.default');$path=config('database.connections.'.$connection.'.database');
echo json_encode(['connection'=>$connection,'database'=>$path,'exists'=>is_string($path)&&is_file($path)],JSON_PRETTY_PRINT);
