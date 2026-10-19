<?php
namespace App\Http\Controllers;
use App\Services\AvatarJobCancellationService;
use Illuminate\Http\Request;
class AvatarJobCancellationController extends Controller {
    public function cancelAll(Request $request,string $type,AvatarJobCancellationService $service){
        abort_unless(isset($service::TYPES[$type]),404);$model=$service::TYPES[$type];
        if($type==='enhancement')\App\Models\AvatarEvolutionSetting::current()->update(['enabled'=>false]);
        if($type==='preparation')\App\Models\AvatarPreparationSetting::current()->update(['enabled'=>false]);
        foreach($model::whereIn('status',$service::CANCELLABLE)->pluck('id')as $id)$service->request($type,$id,'user:'.$request->user()->id);
        return back()->with('status','Cancellation requested for all '.$type.' jobs. Existing published assets remain available.');
    }
    public function cancel(Request $request,string $type,string $id,AvatarJobCancellationService $service){
        $service->request($type,$id,'user:'.$request->user()->id);
        return back()->with('status','Cancellation requested. Publication is blocked immediately; the worker will confirm when processing stops.');
    }
}
