#!/usr/bin/env bash

#
# destination host
#
host="localhost"

#
# destination port
#
port=1234

#
# Time interval between updates (in seconds)
#
interval=5

#
# host info
#
hostname=`hostname`

#
# timestamp
#
now=`date +%s`

template="{ \
  \"sn\": \"NAME\", \
  \"hn\": \"HOST\", \
  \"ts\": NOW, \
  \"value\": \"VALUE\" \
}"

send() {

  count=0

  # cpu, mem & processes
  read -a metrics <<< $(ps -e -o pcpu,pmem | awk '{
    pcpu += $1;
    pmem += $2;
    proc += 1;
  } END {
    print pcpu,pmem,proc
  }')

  for metric in pcpu pmem procs; do

    pcpu_json=$(echo $template | \
      sed \
        -e "s/NOW/$now/g" \
        -e "s/NAME/$metric/g" \
        -e "s/VALUE/${metrics[$count]}/g" \
        -e "s/HOST/$hostname/g")
    count=$(($count+1))
    echo $pcpu_json | netcat -u -q 0 $host $port
  done
}

while [ true ]; do
  now=`date +%s`
  send
  sleep $interval
done
