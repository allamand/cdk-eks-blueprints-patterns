

k get ing -A --context arn:aws:eks:us-east-2:382076407153:cluster/ssp-test-blueprint
k get ing -A --context arn:aws:eks:eu-west-3:382076407153:cluster/ssp-dev-blueprint


helm get values ssp-addon-argocd -n argocd  
helm get values ssp-addon-argocd -n argocd   

k get applications.argoproj.io -n argocd bootstrap-apps  -o yaml    

k get applications.argoproj.io -n argocd team-burnham -o yaml 


## Argo

k9s port forward

https://localhost:8080/applications
admin / c525e326df549f3d08312b1850ff78e84cf045b1

```
kubectl port-forward --namespace argocd \
    deployment/ssp-addon-argocd-server 9092:80
```

## KubeCost demo

```
kubectl port-forward --namespace kubecost \
    deployment/kubecost-cost-analyzer 9091:9090
```