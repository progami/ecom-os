all:
  hosts:
    wms-server:
      ansible_host: ${public_ip}
      ansible_user: ubuntu
      private_ip: ${private_ip}
      instance_id: ${instance_id}
  children:
    wms_servers:
      hosts:
        wms-server: